#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/in.h>
#define WHITELIST_MAX 1024

// ─── 统计数据 ────────────────────────────────────────
struct stats_val {
    __u64 passed_total;
    __u64 dropped_total;
    __u64 tcp_dropped;
    __u64 udp_dropped;
    __u64 icmp_dropped;
    __u64 other_dropped;
};

// ─── Map 1：全局统计（key=0） ────────────────────────
struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, __u32);
    __type(value, struct stats_val);
} global_stats SEC(".maps");

// ─── Map 2：IP 白名单 ────────────────────────────────
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, WHITELIST_MAX);
    __type(key, __u32);   // IPv4 (网络字节序)
    __type(value, __u8);  // 1 = 白名单
} whitelist_map SEC(".maps");

// ─── Map 3：per-IP 拒绝计数 ──────────────────────────
// key: 源 IP，value: 该 IP 被拒的总包数
struct{
    __uint(type,BPF_MAP_TYPE_LRU_HASH);
    __uint(max_entries,10240);
    __type(key,__u32);
    __type(value,__u64);
}drop_by_ip SEC(".maps");

// ─── 主程序 ──────────────────────────────────────────
SEC("xdp")
int xdp_guardian_prog(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data     = (void *)(long)ctx->data;

    struct iphdr *iph;
    struct ethhdr *eth = data;

    // 兼容 native / generic：试着跳过以太网帧头
    if ((void *)(eth + 1) <= data_end &&
        eth->h_proto == __constant_htons(ETH_P_IP)) {
        iph = (void *)(eth + 1);
    } else {
        iph = data;
    }

    if ((void *)(iph + 1) > data_end) {
        return XDP_PASS;
    }

    if (iph->version != 4) {
        return XDP_PASS;
    }

    __u32 key = 0;
    struct stats_val *stats = bpf_map_lookup_elem(&global_stats, &key);

    __u32 src_ip = iph->saddr;

    // ─── 白名单：直接放行 ─────────────────────────
    __u8 *white = bpf_map_lookup_elem(&whitelist_map, &src_ip);
    if (white && *white == 1) {
        if (stats) __sync_fetch_and_add(&stats->passed_total, 1);
        return XDP_PASS;
    }

    // ─── 不在白名单：直接丢，按协议分类统计 ──────
    if (stats) {
        __sync_fetch_and_add(&stats->dropped_total, 1);

        switch (iph->protocol) {
            case IPPROTO_TCP:
                __sync_fetch_and_add(&stats->tcp_dropped, 1);
                break;
            case IPPROTO_UDP:
                __sync_fetch_and_add(&stats->udp_dropped, 1);
                break;
            case IPPROTO_ICMP:
                __sync_fetch_and_add(&stats->icmp_dropped, 1);
                break;
            default:
                __sync_fetch_and_add(&stats->other_dropped, 1);
                break;
        }
    }

    // per-ip count 
    __u64 *cnt = bpf_map_lookup_elem(&drop_by_ip, &src_ip);
    if(cnt){
        __sync_fetch_and_add(cnt,1);
    }else{
        __u64 one = 1;
        bpf_map_update_elem(&drop_by_ip,&src_ip,&one, BPF_ANY);
    }

    return XDP_DROP;
}

char _license[] SEC("license") = "GPL";