import type { CrmStageTemplate } from '../../mock/types';

export interface WizardData {
  workspace: {
    name: string;
    website: string;
    industry: string;
  };
  product: {
    name: string;
    description: string;
    targetBuyer: string;
    problemSolved: string;
  };
  crm: {
    template: CrmStageTemplate;
    // Only consulted when template === 'custom'.
    customStages: Array<{ id: string; name: string }>;
  };
}

export const initialWizardData: WizardData = {
  workspace: { name: '', website: '', industry: '' },
  product: { name: '', description: '', targetBuyer: '', problemSolved: '' },
  crm: {
    template: 'simple_b2b_sales',
    customStages: [
      { id: 'stage_1', name: '' },
      { id: 'stage_2', name: '' },
    ],
  },
};
