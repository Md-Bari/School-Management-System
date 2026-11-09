export const NETWORK_ERROR = 'NETWORK_ERROR';

/** Error thrown by the API client. `code` is the backend's machine-readable error code. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** User-facing (Bangla) text for each backend error code. */
const MESSAGES: Record<string, string> = {
  [NETWORK_ERROR]:
    'সার্ভারের সাথে সংযোগ করা যাচ্ছে না। সার্ভার চালু আছে কিনা বা ইন্টারনেট সংযোগ দেখে একটু পরে আবার চেষ্টা করুন।',
  NO_SEATS: 'দুঃখিত, এই class-এ আর কোনো খালি seat নেই।',
  ALREADY_APPLIED: 'এই class-এ এই শিক্ষার্থীর একটি চলমান আবেদন আগে থেকেই আছে। "আমার আবেদন" পাতায় দেখুন।',
  ALREADY_CONFIRMED: 'এই class-এ এই শিক্ষার্থীর ভর্তি আগেই নিশ্চিত হয়েছে।',
  ALREADY_ADMITTED:
    'এই শিক্ষার্থী ইতিমধ্যে অন্য একটি class-এ ভর্তি হয়েছে। একজন শিক্ষার্থী শুধু একটি class-এই ভর্তি হতে পারে।',
  HOLD_EXPIRED: 'আবেদনের মেয়াদ শেষ হয়ে গেছে, তাই seat ছেড়ে দেওয়া হয়েছে। চাইলে আবার আবেদন করুন।',
  HOLD_CANCELLED: 'এই আবেদনটি বাতিল করা হয়েছে।',
  CANNOT_CANCEL_CONFIRMED: 'ভর্তি নিশ্চিত হয়ে গেছে, তাই এই আবেদন আর বাতিল করা যাবে না।',
  NOT_YOUR_HOLD: 'এই আবেদনটি অন্য একজন শিক্ষার্থীর (ভিন্ন জন্ম নিবন্ধন নম্বর)।',
  MISSING_STUDENT_ID: 'আগে উপরের ঘরে শিক্ষার্থীর ১৭ অঙ্কের জন্ম নিবন্ধন নম্বর লিখুন।',
  INVALID_STUDENT_ID: 'জন্ম নিবন্ধন নম্বর অবশ্যই ঠিক ১৭ অঙ্কের হতে হবে।',
  CLASS_NOT_FOUND: 'এই class-টি খুঁজে পাওয়া যায়নি।',
  HOLD_NOT_FOUND: 'এই আবেদনটি খুঁজে পাওয়া যায়নি।',
  VALIDATION_ERROR: 'দেওয়া তথ্য সঠিক নয়। ঘরগুলো দেখে আবার চেষ্টা করুন।',
  INVALID_JSON: 'অনুরোধটি সঠিক ফরম্যাটে পাঠানো যায়নি।',
  SERVICE_UNAVAILABLE: 'সার্ভার এই মুহূর্তে ব্যস্ত বা ডাটাবেস চালু নেই। একটু পরে আবার চেষ্টা করুন।',
  INTERNAL_ERROR: 'সার্ভারে একটি অপ্রত্যাশিত সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।',
};

const FALLBACK = 'কিছু একটা সমস্যা হয়েছে। একটু পরে আবার চেষ্টা করুন।';

/** Converts anything thrown by the API layer into a sentence a parent can understand. */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (MESSAGES[error.code]) return MESSAGES[error.code];
    if (error.status >= 500) return MESSAGES.INTERNAL_ERROR;
    if (error.status === 404) return 'যা খুঁজছেন তা পাওয়া যায়নি।';
  }
  return FALLBACK;
}

export function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? error.code : undefined;
}
