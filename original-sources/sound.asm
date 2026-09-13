Parameters: R5_94, R5_89, R5_80
3B02: a0 07                    R5_95:      LDY    #$07
3B04:                     3B03 R5_94:      .equ   *-1
3B04: a2 00                    L3B04:      LDX    #$00
3B06: 8a                       L3B06:      TXA
3B07: 18                                   CLC
3B08: e9 01                    L3B08:      SBC    #$01
3B0A:                     3B09 R5_89:      .equ   *-1
3B0A: d0 fc               3B08             BNE    L3B08
3B0C: 8d 30 c0                             STA    LC030
3B0F: e8                                   INX
3B10: e0 8c                                CPX    #$8C
3B12:                     3B11 R5_80:      .equ   *-1
3B12: d0 f2               3B06             BNE    L3B06
3B14: 88                                   DEY
3B15: d0 ed               3B04             BNE    L3B04
3B17: 60                                   RTS
