import Link from "next/link";
import { MessageSquare, Mail, Users, Shield } from "lucide-react";

const items = [
  {
    href: "/settings/sms",
    icon: MessageSquare,
    title: "SMS 설정",
    desc: "Aligo API Key + 발신번호 등록",
    color: "bg-green-50 text-green-600",
  },
  {
    href: "/settings/email",
    icon: Mail,
    title: "이메일 설정",
    desc: "내 이메일 SMTP 연결 (Gmail, Naver 등)",
    color: "bg-blue-50 text-blue-600",
  },
  {
    href: "/settings/members",
    icon: Users,
    title: "팀원 관리",
    desc: "판매원 초대 및 권한 설정",
    color: "bg-purple-50 text-purple-600",
  },
  {
    href: "/settings/organization",
    icon: Shield,
    title: "조직 설정",
    desc: "조직명, 플랜 정보",
    color: "bg-orange-50 text-orange-600",
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-lg mx-auto p-4 md:p-6">
      <h1 className="text-xl font-bold text-navy-900 mb-6">설정</h1>
      <div className="space-y-3">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 bg-white rounded-xl border border-gray-200 p-4 hover:border-gold-300 hover:shadow-sm transition-all"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${item.color}`}>
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{item.title}</p>
              <p className="text-sm text-gray-500 mt-0.5">{item.desc}</p>
            </div>
            <span className="ml-auto text-gray-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
