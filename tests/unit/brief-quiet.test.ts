import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ events: [] as object[], personal: [] as object[], company: [] as object[], asks: [] as object[], reports: [] as object[], live: { generatedAt: Date.now(), status: [] as object[], domains: [] as object[], monitors: [] as object[], events: [] as object[] } }));
vi.mock('@/server/settings', () => ({ getSettings: async () => ({ name: 'Antonio' }) }));
vi.mock('@/server/calendar', () => ({ eventsBetween: async () => fixture.events }));
vi.mock('@/server/tasks', () => ({ listTasks: async ({ scope }: { scope: string }) => scope === 'empresa' ? fixture.company : fixture.personal }));
vi.mock('@/server/agents', () => ({ agentTasks: async () => fixture.asks }));
vi.mock('@/server/ops-live', () => ({ liveOps: async () => fixture.live }));
vi.mock('@/server/crm', () => ({ CRM_ASSIGNEE: {}, crmOverview: async () => ({ configured: true, ok: true, summary: { oportunidades_abertas: 25 }, mine: [], team: [] }) }));
vi.mock('@/server/agent-reports', () => ({ agentReports: async () => fixture.reports }));
import { buildBrief } from '@/server/brief';
beforeEach(() => { fixture.events = []; fixture.personal = []; fixture.company = []; fixture.asks = []; fixture.reports = []; const now = Date.now(); fixture.live = { generatedAt: now, status: [{ ok: true, source: 'ping', checkedAt: new Date(now) }], domains: [], monitors: [{ source: 'ping', silent: false, everyMinutes: 15 }], events: [] }; });
it('healthy operation and no due work produce no message', async () => {
  expect(await buildBrief()).toBe('');
});
it('a reply handed back to an agent no longer repeats as work waiting for Antonio', async () => {
  const answered = { title: 'Executar decisão respondida', status: 'todo', tags: ['agente:tom', 'resposta:antonio'], dueDate: '2020-01-01' };
  fixture.company = [answered]; fixture.asks = [answered];
  expect(await buildBrief()).toBe('');
});
it('includes real due work, escapes HTML and omits empty scopes and healthy sections', async () => {
  fixture.company = [{ title: 'Revisar <produto>', dueDate: '2020-01-01' }];
  const brief = await buildBrief();
  expect(brief).toContain('Revisar &lt;produto&gt;');
  expect(brief).toContain('<b>Empresa</b>');
  expect(brief).not.toMatch(/Pessoal|Dia livre|nada para hoje|Operação|oportunidade/);
});
it('resolved errors stay silent and missing monitoring remains actionable', async () => {
  fixture.live.events = [{ kind: 'workflow_error', resolvedAt: new Date(), createdAt: new Date() }];
  expect(await buildBrief()).toBe('');
  fixture.live.status = [];
  expect(await buildBrief()).toContain('Sem dados dos monitores');
});
it('avisa quando o último registro não é recente mesmo se o monitor envia batidas', async () => {
  fixture.live.status = [{ ok: true, source: 'ping', checkedAt: new Date(fixture.live.generatedAt - 60 * 60_000) }];
  expect(await buildBrief()).toContain('1 endereço(s) sem verificação recente');
});
