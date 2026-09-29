#!/bin/bash
BPFTOOL=/usr/local/bin/bpftool-core
IFACE=${IFACE:-eth0}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# 找一个 map 的最新 id
find_map_id() {
    local name="$1"
    $BPFTOOL map show -j 2>/dev/null | python3 -c "
import sys, json
try:
    maps = json.load(sys.stdin)
except Exception:
    sys.exit(1)
ids = [m['id'] for m in maps if m.get('name') == '$name']
print(ids[-1] if ids else '')
"
}

case "$1" in
    "reload")
        echo "Detaching existing XDP on $IFACE..."
        sudo ip link set dev "$IFACE" xdpgeneric off 2>/dev/null
        sudo ip link set dev "$IFACE" xdpdrv off 2>/dev/null
        sudo ip link set dev "$IFACE" xdp off 2>/dev/null

        echo "Rebuilding..."
        (cd "$SCRIPT_DIR/xdp" && make clean && make) || exit 1

        echo "Attaching in generic mode..."
        sudo ip link set dev "$IFACE" xdpgeneric obj "$SCRIPT_DIR/xdp/xdp_guardian.o" sec xdp || exit 1

        echo "Verifying:"
        ip link show "$IFACE" | grep xdp
        ;;

    "dump-stats")
        ID=$(find_map_id global_stats)
        [ -z "$ID" ] && { echo '{"error": "global_stats not found. Run: ./xdp-helper.sh reload"}' >&2; exit 1; }
        exec $BPFTOOL map dump id "$ID" -j
        ;;

    "dump-whitelist")
        ID=$(find_map_id whitelist_map)
        [ -z "$ID" ] && { echo '{"error": "whitelist_map not found. Run: ./xdp-helper.sh reload"}' >&2; exit 1; }
        exec $BPFTOOL map dump id "$ID" -j
        ;;

    "dump-drop-by-ip")
        ID=$(find_map_id drop_by_ip)
        [ -z "$ID" ] && { echo '{"error": "drop_by_ip not found. Run: ./xdp-helper.sh reload"}' >&2; exit 1; }
        exec $BPFTOOL map dump id "$ID" -j
        ;;

    "add-whitelist")
        ID=$(find_map_id whitelist_map)
        [ -z "$ID" ] && { echo "whitelist_map not found" >&2; exit 1; }
        exec $BPFTOOL map update id "$ID" key $2 $3 $4 $5 value 0x01
        ;;

    "del-whitelist")
        ID=$(find_map_id whitelist_map)
        [ -z "$ID" ] && { echo "whitelist_map not found" >&2; exit 1; }
        exec $BPFTOOL map delete id "$ID" key $2 $3 $4 $5
        ;;

    *)
        echo "Usage: $0 {reload|dump-stats|dump-whitelist|dump-drop-by-ip|add-whitelist <b1> <b2> <b3> <b4>|del-whitelist <b1> <b2> <b3> <b4>}"
        exit 1
        ;;
esac
