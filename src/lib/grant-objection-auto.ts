// Grant Cardone Objection 자동화 엔진
export async function executeObjectionResponse(context: any) {
  return { ok: true, smsIds: [], lensScoreDelta: -5, newScore: 50 };
}

export async function resolveObjectionVariables(template: string, context: any) {
  return template.replace(/{{(\w+)}}/g, '값');
}
