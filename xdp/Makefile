# Compiler and flags for eBPF target
CLANG ?= clang
LLC ?= llc

# Compilation flags
# -O2 is required for eBPF code optimization and verification by the Linux kernel
CFLAGS := -O2 -g -target bpf -D__BPF_TRACING__

# Source and target definition
SRC := xdp_guardian.c
OBJ := xdp_guardian.o

.PHONY: all clean

# Default target
all: $(OBJ)

# Compile C source into eBPF ELF object file
$(OBJ): $(SRC)
	$(CLANG) $(CFLAGS) -c $< -o $@

# Clean up build artifacts
clean:
	rm -f $(OBJ)