import { env } from '../config/env';

export interface SmsProvider { sendOtp(phone: string, otp: string): Promise<void> }

/** Development only: prints the code in the server window instead of sending an SMS. */
class ConsoleSms implements SmsProvider {
  async sendOtp(phone: string, otp: string) {
    console.log(`[DEV SMS] OTP for +91${phone}: ${otp}`);
  }
}

/** MSG91 OTP API. Needs MSG91_AUTH_KEY and MSG91_TEMPLATE_ID (DLT-approved template). */
class Msg91Sms implements SmsProvider {
  async sendOtp(phone: string, otp: string) {
    const url = new URL('https://control.msg91.com/api/v5/otp');
    url.searchParams.set('template_id', env.MSG91_TEMPLATE_ID!);
    url.searchParams.set('mobile', `91${phone}`);
    url.searchParams.set('otp', otp);
    const res = await fetch(url, { method: 'POST', headers: { authkey: env.MSG91_AUTH_KEY!, 'content-type': 'application/json' }, body: '{}' });
    if (!res.ok) throw new Error(`SMS provider error ${res.status}`);
  }
}

let provider: SmsProvider = env.SMS_PROVIDER === 'msg91' ? new Msg91Sms() : new ConsoleSms();
export const getSmsProvider = () => provider;
export const setSmsProvider = (p: SmsProvider) => { provider = p; }; // used by automated tests
