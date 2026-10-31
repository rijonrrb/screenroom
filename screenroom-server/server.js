'use strict';
// Dedicated Passenger/cPanel entrypoint; app.js remains importable without listening in unit tests.
const {app}=require('./app.js');
const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log('SCREENROOM API listening on port '+port));
