import { notifications } from '@mantine/notifications';
import { IconBroadcast } from '@tabler/icons-react';
import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { copilotDeepLink } from '../../lib/copilot';
import { useCopilot } from '../../mock/store';

// The shared "launch the Live Co-pilot" action (M19, PG-236). One entry point
// behind both the per-opportunity header button and the `/copilot` screen's
// own launch affordance:
//   - app not installed → route the rep to `/copilot` to get it.
//   - app installed     → mock the deep-link handoff to the desktop app, with
//                         the opportunity id attached when launching from a deal.
// The deep link is mocked as a notification — the prototype can't open a real
// desktop process or custom URL scheme.
export function useStartCopilot() {
  const copilot = useCopilot();
  const navigate = useNavigate();

  return useCallback(
    (opportunityId?: string) => {
      if (copilot.installState === 'not_installed') {
        navigate({ to: '/copilot' });
        return;
      }
      const link = copilotDeepLink(opportunityId);
      notifications.show({
        title: 'Launching the Live Co-pilot',
        message:
          copilot.installState === 'connected'
            ? `Handing the session to your desktop app — ${link}`
            : `Opening your desktop app — you'll be asked to sign in first. (${link})`,
        icon: <IconBroadcast size={16} />,
        color: 'indigo',
      });
    },
    [copilot.installState, navigate],
  );
}
