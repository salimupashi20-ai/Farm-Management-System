const {scrypt,randomBytes,createHash,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');const derive=promisify(scrypt);
const hash=v=>createHash('sha256').update(v).digest('hex');
const token=()=>randomBytes(32).toString('base64url');
async function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>128)throw Object.assign(new Error('Use a password between 12 and 128 characters.'),{status:400});const salt=token();return salt+':'+(await derive(password,salt,64)).toString('hex')}
async function verify(password,stored){if(typeof password!=='string'||password.length>128)return false;const [salt,key]=stored.split(':');const got=await derive(password,salt,64);const expected=Buffer.from(key,'hex');return expected.length===got.length&&timingSafeEqual(got,expected)}
module.exports={hash,token,passwordHash,verify};
