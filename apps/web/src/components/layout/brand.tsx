import { Group, Text } from '@mantine/core';
import { IconTargetArrow } from '@tabler/icons-react';

interface BrandProps {
  size?: 'sm' | 'md' | 'lg';
}

export function Brand({ size = 'md' }: BrandProps) {
  const iconSize = size === 'lg' ? 24 : size === 'sm' ? 18 : 20;
  const textSize = size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md';
  return (
    <Group gap="xs">
      <IconTargetArrow size={iconSize} />
      <Text fw={600} size={textSize}>
        Pitch Genius
      </Text>
    </Group>
  );
}
