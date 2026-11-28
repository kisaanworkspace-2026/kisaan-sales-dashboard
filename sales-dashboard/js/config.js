/* ===== Edit this file only. =====
   API_URL: paste your Apps Script Web App URL (ends with /exec). Leave '' to run on the bundled sample data (demo mode). */
window.CFG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwKPGEHNxoEj9Qzjv-8afu2krkw4tBk5VQU3cYsSTE7eXjiZBOoQnwHiCTIh8GLz5AT/exec',
  SAMPLE_URL: 'data/sample.json',
  SAMPLE_INTERSTATE_URL: 'data/sample-interstate.json',   // optional demo file; without it the Interstate pages show an empty state
  TITLE: 'Kisaan Sales',
  CURRENCY: 'AUD',
  // fixed colours for known order types (anything new gets a palette colour automatically)
  TYPE_COLORS: { b2b: '#1f7a5a', b2c: '#2f6fbb', manual_b2c: '#e0a526', preferred: '#7a5cc2' },
  PALETTE: ['#1f7a5a', '#2f6fbb', '#e0a526', '#d1495b', '#7a5cc2', '#2aa5b3', '#e07a3f', '#8a9a5b']
};
