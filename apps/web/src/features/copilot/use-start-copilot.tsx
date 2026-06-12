import { notifications } from '@mantine/notifications';
import { IconBroadcast } from '@tabler/icons-react';
import { useCallback } from 'react';
import { copilotDeepLink } from '../../lib/copilot';
import { trpc } from '../../trpc';

// The shared "launch the Live Co-pilot" action (M19/PG-289). Mints a short-lived,
// single-use token and opens the pitchgenius:// deep link; the desktop app
// exchanges the token for a session on the other side and binds the call to the
// opportunity (when launched from a deal).
//
// The earlier mock install-state gate (bounce to /copilot when "not installed")
// is removed now that the real handoff exists — the browser can't reliably detect
// a custom-scheme handler anyway. The /copilot screen stays reachable from nav for
// first-time download; if the app isn't installed the OS simply ignores the link.
export function useStartCopilot() {
  const mintLaunchToken = trpc.copilot.mintLaunchToken.useMutation();

  return useCallback(
    async (opportunityId?: string) => {
      try {
        const { token } = await mintLaunchToken.mutateAsync();
        window.location.href = copilotDeepLink(opportunityId, token);
        notifications.show({
          title: 'Launching PG.AI PILOT',
          message: 'Handing the session to your desktop app…',
          icon: <IconBroadcast size={16} />,
          color: 'indigo',
        });
      } catch {
        notifications.show({
          title: 'Could not launch PG.AI PILOT',
          message: 'Failed to create a secure launch token. Please try again.',
          color: 'red',
        });
      }
    },
    [mintLaunchToken],
  );
}
