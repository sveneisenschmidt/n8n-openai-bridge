const { extractFilesFromMultimodal } = require('../../src/utils/fileProcessor');
test('extracts XLSX file content parts without treating them as images', () => {
  const files = extractFilesFromMultimodal(
    {
      role: 'user',
      content: [
        {
          type: 'file',
          file: {
            filename: 'sales.xlsx',
            url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEsDBA==',
          },
        },
      ],
    },
    0,
  );
  expect(files).toEqual([
    {
      name: 'sales.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: 'UEsDBA==',
    },
  ]);
});

test('rejects non-XLSX file content parts', () => {
  const files = extractFilesFromMultimodal(
    {
      role: 'user',
      content: [
        {
          type: 'file',
          file: { filename: 'secret.pdf', url: 'data:application/pdf;base64,UEsDBA==' },
        },
      ],
    },
    0,
  );
  expect(files).toEqual([]);
});

test('extract-xlsx-json preserves image parts while extracting XLSX content', () => {
  const { processMessages } = require('../../src/utils/fileProcessor');
  const image = { type: 'image_url', image_url: { url: 'data:image/png;base64,aW1n' } };
  const xlsx = {
    type: 'file',
    file: {
      filename: 'book.xlsx',
      url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEs=',
    },
  };
  const result = processMessages(
    [{ role: 'user', content: [{ type: 'text', text: 'analyseer' }, image, xlsx] }],
    'extract-xlsx-json',
  );
  expect(result.files).toHaveLength(1);
  expect(result.messages[0].content).toEqual([{ type: 'text', text: 'analyseer' }, image]);
});

test('n8n client payload exposes extracted XLSX files in extract-xlsx-json mode', () => {
  const N8nClient = require('../../src/n8nClient');
  const client = new N8nClient({ fileUploadMode: 'extract-xlsx-json' });
  const payload = client.buildPayload(
    [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'bewerk' },
          {
            type: 'file',
            file: {
              filename: 'book.xlsx',
              url: 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,UEs=',
            },
          },
        ],
      },
    ],
    'session-1',
    { userId: 'user-1' },
  );
  expect(payload.files).toEqual([
    {
      name: 'book.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      data: 'UEs=',
    },
  ]);
});
