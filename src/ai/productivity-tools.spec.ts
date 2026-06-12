import { toolSchemas } from './productivity-tools';

describe('productivity tool schemas', () => {
  it('requires confirmation before createTask can execute', () => {
    expect(() =>
      toolSchemas.createTask.parse({ title: 'Submit project' }),
    ).toThrow();
    expect(
      toolSchemas.createTask.parse({ title: 'Submit project', confirmed: true })
        .title,
    ).toBe('Submit project');
  });
});
