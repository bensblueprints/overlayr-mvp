const { createApp } = require('./app');

const PORT = Number(process.env.PORT) || 5337;
const { server } = createApp();

server.listen(PORT, () => {
  console.log('Overlayr running');
  console.log(`  Admin dashboard : http://localhost:${PORT}/admin`);
  console.log(`  Overlay pages   : http://localhost:${PORT}/o/<token>`);
  console.log(`  Webhook         : POST http://localhost:${PORT}/hook/<token>`);
});
