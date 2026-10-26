import { describe, it, expect } from 'vitest';
import { validateProductMetrics } from '@/lib/product-metrics';
const freemium = {version:1,publishedPages:5,onlinePages:4,publishers:3,trips:null,tripCreators:null,subscriptionAccessUsers:5,paidSubscriptionUsers:2,proMonthly:1,proYearly:1,businessMonthly:0,businessYearly:0,tripPurchases30d:null,tripBuyers30d:null,tripRevenueCents30d:null,currency:'BRL',basis:'current_records_and_confirmed_payments'};
const at = new Date().toISOString();
const snapshot = {version:1,product:'mecard',generatedAt:at,window:{from:new Date(Date.parse(at)-30*86400000).toISOString(),to:at},metrics:{users:12,accounts:null,activeAccounts:null,trialAccounts:null,payingAccounts:null,complimentaryAccounts:null,canceledAccounts:null,activatedAccounts:null},freemium};
describe('projeção freemium na Órbita',()=>{
 it('preserva unidade e remove campos de identidade adicionais',()=>{
  const result=validateProductMetrics({...snapshot,freemium:{...freemium,email:'private@example.test'}},'mecard');
  expect(result.freemium?.paidSubscriptionUsers).toBe(2);
  expect(JSON.stringify(result)).not.toContain('private');
 });
 it('recusa contagens contraditórias e troca do modelo',()=>{
  for(const change of [{paidSubscriptionUsers:3},{onlinePages:6},{publishers:13},{proMonthly:null},{proYearly:-1},{tripPurchases30d:0}]) expect(()=>validateProductMetrics({...snapshot,freemium:{...freemium,...change}},'mecard')).toThrow();
  expect(()=>validateProductMetrics({...snapshot,product:'viajeki'},'viajeki')).toThrow();
  expect(()=>validateProductMetrics({...snapshot,metrics:{...snapshot.metrics,accounts:12}},'mecard')).toThrow();
 });
});
