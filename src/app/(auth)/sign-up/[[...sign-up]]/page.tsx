import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gold-500">mabiz</h1>
          <p className="text-gray-300 mt-2 text-sm">크루즈 영업 파트너 CRM</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
