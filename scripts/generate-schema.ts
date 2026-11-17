import fs from 'node:fs';
import path from 'node:path';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { GuideSchema } from '../src/schemas/guide.js';

const jsonSchema = zodToJsonSchema(GuideSchema, {
  name: 'StudyGuide',
  $refStrategy: 'relative',
});

const outputPath = path.resolve('schemas/guide.schema.json');
fs.writeFileSync(outputPath, JSON.stringify(jsonSchema, null, 2), 'utf-8');

console.log(`Successfully generated JSON Schema at: ${outputPath}`);
