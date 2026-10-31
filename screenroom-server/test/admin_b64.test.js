'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const bcrypt=require('bcryptjs');

const generatedHash=bcrypt.hashSync('example-local-test-password',4);
process.env.DB_HOST='localhost';
process.env.DB_USER='unused_local_test_user';
process.env.DB_PASSWORD='unused_local_test_password';
process.env.DB_NAME='unused_local_test_database';
process.env.ADMIN_USERNAME='screenroom_admin';
process.env.ADMIN_PASSWORD_HASH='cPanel-mangled-original';
process.env.ADMIN_PASSWORD_HASH_B64=Buffer.from(generatedHash,'utf8').toString('base64');
process.env.SESSION_SECRET='x'.repeat(64);
process.env.SITE_ORIGIN='https://screenroom.devrijonn.com';

const {app}=require('../app.js');

test('Admin login accepts encoded bcrypt hash without depending on raw cPanel variable',async()=>{
 const server=app.listen(0);
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/admin/login';
  const res=await fetch(url,{method:'POST',headers:{'content-type':'application/json',origin:process.env.SITE_ORIGIN},body:JSON.stringify({username:'incorrect-user',password:'incorrect-password'})});
  assert.equal(res.status,401);
  assert.equal((await res.json()).error,'Invalid credentials.');
 }finally{await new Promise(resolve=>server.close(resolve));}
});
