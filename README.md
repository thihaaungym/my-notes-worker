# mynote
Cloudflare ecosystem ပေါ်မှာ အလုံးစုံ တည်ဆောက်ထားတဲ့ ရိုးရှင်းပြီး လုံခြုံတဲ့ ကိုယ်ပိုင် Note-taking web app တစ်ခု ဖြစ်ပါတယ်။ Logic အတွက် Cloudflare Workers၊ Database အတွက် KV Store နဲ့ Password ကာကွယ်မှုအတွက် Environment Variables တို့ကို အသုံးပြုထားပါတယ်။

| Variable Name | ရှင်းလင်းချက် | ဥပမာ / သတ်မှတ်ရမည့်တန်ဖိုး |
| :--- | :--- | :--- |
| `AUTH_PASS` | Web app ကို ဝင်ရောက်ရန် Password | `Your_Secret_Password123!` |
| `NOTE_KV` | Note များကို သိမ်းဆည်းရန် KV Binding | (Dropdown မှ `NOTES_DB` ကို ရွေးပါ) |
