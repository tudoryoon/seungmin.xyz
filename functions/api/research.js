import sealed from '../../lib/research-sealed.js';
import { createResearchAccess } from '../../lib/research-access.js';

const handle = createResearchAccess(sealed);
export const onRequest = ({ request, env }) => handle(request, env);
