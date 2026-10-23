#include <linux/bpf.h>
#include <bpf/bpf_helpers.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/in.h>
#define WHITELIST_MAX 1024

// Packet statistics shared with the userspace manager.
struct stats_val {
    __u64 passed_total;
    __u64 dropped_total;
    __u64 tcp_dropped;
    __u64 udp_dropped;
    __u64 icmp_dropped;
    __u64 other_dropped;
};

// Map 1: global statistics (key = 0).
struct {
    __uint(type, BPF_MAP_TYPE_ARRAY);
    __uint(max_entries, 1);
    __type(key, __u32);
    __type(value, struct stats_val);
} global_stats SEC(".maps");

// Map 2: IPv4 whitelist.
struct {
    __uint(type, BPF_MAP_TYPE_HASH);
    __uint(max_entries, WHITELIST_MAX);
    __type(key, __u32); // IPv4 address in network byte order.
    __type(value, __u8); // 1 means the address is allowlisted.
} whitelist_map SEC(".maps");

// Map 3: cumulative packets dropped for each source IPv4 address.
struct {
    __uint(type, BPF_MAP_TYPE_LRU_HASH);
    __uint(max_entries, 10240);
    __type(key, __u32);
    __type(value, __u64);
} drop_by_ip SEC(".maps");

// Main XDP packet filter.
SEC("xdp")
int xdp_guardian_prog(struct xdp_md *ctx) {
    void *data_end = (void *)(long)ctx->data_end;
    void *data = (void *)(long)ctx->data;

    struct iphdr *iph;
    struct ethhdr *eth = data;

    // Support native and generic modes by detecting an optional Ethernet header.
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

    // Allow traffic from whitelisted addresses.
    __u8 *white = bpf_map_lookup_elem(&whitelist_map, &src_ip);
    if (white && *white == 1) {
        if (stats) {
            __sync_fetch_and_add(&stats->passed_total, 1);
        }
        return XDP_PASS;
    }

    // Drop non-whitelisted traffic and count it by protocol.
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
    if (cnt) {
        __sync_fetch_and_add(cnt, 1);
    } else {
        __u64 one = 1;
        bpf_map_update_elem(&drop_by_ip, &src_ip, &one, BPF_ANY);
    }

    return XDP_DROP;
}

char _license[] SEC("license") = "GPL";
