import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_TEMPLATES, renderTemplateVariables } from './email-templates';

describe('renderTemplateVariables', () => {
  it('interpolates handlebars-style placeholders while leaving unknown variables intact', () => {
    const out = renderTemplateVariables('Hi {{customer_name}}, ticket #{{ticket_number}} in {{unknown_var}}', {
      customer_name: 'Hannah',
      ticket_number: '1042',
    });
    expect(out).toBe('Hi Hannah, ticket #1042 in {{unknown_var}}');
  });

  it('includes all four compliance and operational template categories', () => {
    const cats = new Set(DEFAULT_EMAIL_TEMPLATES.map((t) => t.category));
    expect(cats).toEqual(new Set(['Conversations', 'Tickets', 'Security', 'Compliance']));
  });
});
