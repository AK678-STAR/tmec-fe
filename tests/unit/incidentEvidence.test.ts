import test from 'node:test';
import assert from 'node:assert/strict';
import { incidentEvidence, withIncidentEvidence } from '../../src/features/stable/utils/incidentEvidence.ts';

test('photo survives legacy description storage without showing base64 text', () => {
  const photoUrl = 'data:image/jpeg;base64,YWJj';
  const description = withIncidentEvidence(' Wound observed. ', photoUrl);
  assert.deepEqual(incidentEvidence({ description }), { photoUrl, description: 'Wound observed.' });
});
test('structured evidence takes priority and old text is unchanged', () => {
  assert.deepEqual(incidentEvidence({ description: 'No photo.' }), { photoUrl: undefined, description: 'No photo.' });
  assert.equal(incidentEvidence({ evidencePhotoUrl: '/photo.jpg', description: '![Photo](https://example.com/old.jpg)' }).photoUrl, '/photo.jpg');
});
test('unsafe URLs are never rendered as evidence', () => {
  assert.equal(incidentEvidence({ evidencePhotoUrl: 'javascript:alert(1)', description: '![x](data:text/html;base64,YWJj)' }).photoUrl, undefined);
});
