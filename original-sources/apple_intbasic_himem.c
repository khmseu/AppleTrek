/**
 * Apple Integer BASIC HIMEM: token implementation
 * 
 * Sets the highest memory address available to the program.
 * Relocates the program and variable storage to accommodate the new boundary.
 * 
 * Converted from 6502 assembly: apple.intbasic.himem.6502
 */

#include <stdint.h>
#include <string.h>

/* Memory pointers (16-bit addresses) */
typedef struct {
    uint16_t himem;      /* Current high memory boundary */
    uint16_t pp;         /* Program pointer (start of program/variables) */
    uint16_t pv;         /* Program/variable end pointer */
    uint8_t *memory;     /* Base memory array */
    size_t memory_size;  /* Total memory size */
} MemoryState;

/* Error codes */
typedef enum {
    HIMEM_OK = 0,
    HIMEM_ERR_MEMFULL = 1,  /* Not enough memory for operation */
} HimemError;

/**
 * Set HIMEM to a new value and relocate program/variable storage
 * 
 * @param state     Memory state structure
 * @param new_himem New high memory boundary
 * @return          Error code (0 on success)
 */
HimemError himem_set(MemoryState *state, uint16_t new_himem)
{
    uint16_t aux;      /* Delta: old HIMEM - new HIMEM */
    uint16_t p2;       /* Destination pointer for relocation */
    uint16_t p3;       /* Source pointer for relocation */
    uint16_t old_himem;

    /* Validate input */
    if (new_himem < 0x0300 || new_himem >= state->memory_size) {
        return HIMEM_ERR_MEMFULL;
    }

    old_himem = state->himem;
    
    /* Phase 1: Compute the delta (difference between old and new HIMEM) */
    if (new_himem >= old_himem) {
        /* Expanding memory: no relocation needed if growing */
        state->himem = new_himem;
        return HIMEM_OK;
    }
    
    /* Shrinking memory: need to relocate */
    aux = old_himem - new_himem;  /* Amount to move down */
    p2 = new_himem;               /* New destination base */
    
    /* Phase 2: Validate there's enough space */
    /* Check if PP - AUX would collide with PV */
    uint16_t new_pp = state->pp - aux;
    if (new_pp < state->pv) {
        return HIMEM_ERR_MEMFULL;
    }
    
    /* Phase 3: Copy memory block from PP to HIMEM down by AUX bytes
     * This relocates the entire program and variable storage down in memory */
    if (state->pp < old_himem) {
        uint16_t src = old_himem - 1;
        uint16_t dst = new_himem - 1;
        uint16_t count = old_himem - state->pp;
        
        /* Copy backwards to avoid overlap */
        while (count > 0) {
            state->memory[dst] = state->memory[src];
            dst--;
            src--;
            count--;
        }
    }
    
    /* Phase 4: Update memory pointers */
    state->himem = new_himem;
    state->pp = new_pp;
    
    return HIMEM_OK;
}

/**
 * Alternative implementation using memmove for clarity
 */
HimemError himem_set_memmove(MemoryState *state, uint16_t new_himem)
{
    uint16_t aux;
    uint16_t old_himem;
    
    if (new_himem < 0x0300 || new_himem >= state->memory_size) {
        return HIMEM_ERR_MEMFULL;
    }
    
    old_himem = state->himem;
    
    if (new_himem >= old_himem) {
        state->himem = new_himem;
        return HIMEM_OK;
    }
    
    aux = old_himem - new_himem;
    
    /* Validate space availability */
    uint16_t new_pp = state->pp - aux;
    if (new_pp < state->pv) {
        return HIMEM_ERR_MEMFULL;
    }
    
    /* Relocate the program/variable block */
    uint32_t block_size = old_himem - state->pp;
    if (block_size > 0) {
        memmove(
            &state->memory[new_pp],
            &state->memory[state->pp],
            block_size
        );
    }
    
    state->himem = new_himem;
    state->pp = new_pp;
    
    return HIMEM_OK;
}

/**
 * Example usage and test
 */
#ifdef HIMEM_TEST

#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    /* Allocate 64KB for simulated Apple II memory */
    uint8_t *memory = malloc(65536);
    if (!memory) return 1;
    
    MemoryState state = {
        .himem = 0xC000,        /* Start at 48KB */
        .pp = 0x0800,           /* Program starts at 2KB */
        .pv = 0x1000,           /* Variables end at 4KB */
        .memory = memory,
        .memory_size = 65536
    };
    
    printf("Initial state:\n");
    printf("  HIMEM: 0x%04X\n", state.himem);
    printf("  PP:    0x%04X\n", state.pp);
    printf("  PV:    0x%04X\n", state.pv);
    
    /* Test lowering HIMEM */
    HimemError err = himem_set(&state, 0xA000);
    if (err == HIMEM_OK) {
        printf("\nAfter HIMEM: 0xA000\n");
        printf("  HIMEM: 0x%04X\n", state.himem);
        printf("  PP:    0x%04X\n", state.pp);
        printf("  PV:    0x%04X\n", state.pv);
    } else {
        printf("Error: HIMEM operation failed\n");
    }
    
    free(memory);
    return 0;
}

#endif /* HIMEM_TEST */
