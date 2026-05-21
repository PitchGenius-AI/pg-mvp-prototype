import { Container, Group, Paper, SimpleGrid, Skeleton, Stack } from '@mantine/core';

// Matches the structure of the M17 ScoreHeader + 4-tab bar + Overview tab so the
// page transitions cleanly into the loaded layout. Used by /opportunities/$id
// while useOpportunity is fetching.
export function OpportunityDetailSkeleton() {
  return (
    <Container size="xl" py="lg">
      <Stack gap="md">
        <ScoreHeaderSkeleton />
        <TabsBarSkeleton />
        <OverviewSkeleton />
      </Stack>
    </Container>
  );
}

function ScoreHeaderSkeleton() {
  return (
    <Stack gap="sm">
      <Skeleton height={12} width={180} radius="sm" />
      <Paper withBorder p="lg" radius="md">
        <Group gap="xl" wrap="nowrap" align="center">
          <Skeleton height={108} circle />
          <Stack gap={8} style={{ flex: 1 }}>
            <Skeleton height={22} width="45%" radius="sm" />
            <Skeleton height={12} width="60%" radius="sm" />
            <Group gap="xs" mt={4}>
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} height={22} width={96} radius="xl" />
              ))}
            </Group>
          </Stack>
        </Group>
      </Paper>
    </Stack>
  );
}

function TabsBarSkeleton() {
  return (
    <Group gap="md">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} height={14} width={70} radius="sm" />
      ))}
    </Group>
  );
}

function OverviewSkeleton() {
  return (
    <Stack gap="md">
      {Array.from({ length: 2 }).map((_, i) => (
        <Paper key={i} withBorder p="md" radius="md">
          <Stack gap="sm">
            <Skeleton height={14} width="35%" radius="sm" />
            <Skeleton height={10} width="90%" radius="sm" />
            <Skeleton height={10} width="80%" radius="sm" />
            <Skeleton height={10} width="60%" radius="sm" />
          </Stack>
        </Paper>
      ))}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        {Array.from({ length: 2 }).map((_, i) => (
          <Paper key={i} withBorder p="md" radius="md">
            <Stack gap="sm">
              <Skeleton height={12} width="40%" radius="sm" />
              <Skeleton height={10} width="85%" radius="sm" />
              <Skeleton height={10} width="70%" radius="sm" />
            </Stack>
          </Paper>
        ))}
      </SimpleGrid>
    </Stack>
  );
}
