import sealed from '../../lib/research-sealed.js';
import { createResearchAccess } from '../../lib/research-access.js';
import { createNotionResearch } from '../../lib/notion-research.js';

const handle = createResearchAccess(sealed, { loadData: createNotionResearch() });
export const onRequest = ({ request, env }) => handle(request, env);
