import React from 'react'
import { Box, ButtonBase, Typography } from '@mui/material'
import { TOKENS } from '../theme/theme'

interface Option {
  value: string
  label: string
  icon?: React.ReactNode
}

interface SegmentedControlProps {
  value: string
  onChange: (val: any) => void
  options: Option[]
}

export default function SegmentedControl({ value, onChange, options }: SegmentedControlProps) {
  return (
    <Box
      sx={{
        display: 'inline-flex',
        p: '4px',
        borderRadius: '999px',
        bgcolor: 'rgba(11, 15, 30, 0.7)',
        border: `1px solid ${TOKENS.borderGlass}`,
        backdropFilter: 'blur(12px)',
        gap: '4px',
      }}
    >
      {options.map((opt) => {
        const isSelected = value === opt.value
        return (
          <ButtonBase
            key={opt.value}
            onClick={() => onChange(opt.value)}
            sx={{
              px: 2,
              py: 0.8,
              borderRadius: '999px',
              background: isSelected ? TOKENS.gradBlue : 'transparent',
              color: isSelected ? '#0B0F1E' : TOKENS.textSecondary,
              fontWeight: isSelected ? 700 : 500,
              fontSize: '0.82rem',
              boxShadow: isSelected ? '0 0 14px rgba(111, 231, 255, 0.4)' : 'none',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
              '&:hover': {
                color: isSelected ? '#0B0F1E' : TOKENS.textPrimary,
                bgcolor: isSelected ? undefined : 'rgba(111, 231, 255, 0.08)',
              },
            }}
          >
            {opt.icon}
            <Typography
              component="span"
              sx={{
                fontSize: 'inherit',
                fontWeight: 'inherit',
                fontFamily: `'Inter', sans-serif`,
              }}
            >
              {opt.label}
            </Typography>
          </ButtonBase>
        )
      })}
    </Box>
  )
}

