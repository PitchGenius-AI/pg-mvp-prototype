import { Container, Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

// Matches the structure of OpportunityHeader + Tabs + Overview tab so the page
// transitions cleanly into the loaded layout. Used by /opportunities/$id while
// useOpportunity is fetching.
export function OpportunityDetailSkeleton() {
  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <HeaderSkeleton />
        <TabsBarSkeleton />
        <DiagnosisCardsSkeleton />
      </Stack>
    </Container>
  );
}

function HeaderSkeleton() {
  return (
    <Paper withBorder p="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap">
          <Stack gap={6} style={{ flex: 1 }}>
            <Skeleton height={22} width="40%" radius="sm" />
            <Skeleton height={12} width="55%" radius="sm" />
          </Stack>
          <Group gap="xs">
            <Skeleton height={22} width={120} radius="xl" />
            <Skeleton height={22} width={100} radius="xl" />
          </Group>
        </Group>
      </Stack>
    </Paper>
  );
}

function TabsBarSkeleton() {
  return (
    <Group gap="md">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} height={14} width={70} radius="sm" />
      ))}
    </Group>
  );
}

export function DiagnosisCardsSkeleton() {
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
        {Array.from({ length: 4 }).map((_, i) => (
          <Paper key={i} withBorder p="md" radius="md">
            <Stack gap={6}>
              <Skeleton height={10} width="60%" radius="sm" />
              <Skeleton height={18} width="80%" radius="sm" />
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
      <Paper withBorder p="md" radius="md">
        <Stack gap="sm">
          <Skeleton height={14} width="35%" radius="sm" />
          <Skeleton height={10} width="80%" radius="sm" />
          <Skeleton height={10} width="70%" radius="sm" />
          <Skeleton height={10} width="75%" radius="sm" />
        </Stack>
      </Paper>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {Array.from({ length: 2 }).map((_, i) => (
          <Paper key={i} withBorder p="md" radius="md">
            <Stack gap="sm">
              <Skeleton height={12} width="40%" radius="sm" />
              <Skeleton height={10} width="90%" radius="sm" />
              <Skeleton height={10} width="80%" radius="sm" />
              <Skeleton height={10} width="60%" radius="sm" />
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
