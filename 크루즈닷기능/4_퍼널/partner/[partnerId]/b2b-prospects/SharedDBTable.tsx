
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface SharedDBTableProps {
    leads: any[];
    onRecall: (leadId: number) => void;
}

export function SharedDBTable({ leads, onRecall }: SharedDBTableProps) {
    if (!leads || leads.length === 0) {
        return (
            <div className="p-8 text-center text-gray-500">
                공유된 DB가 없습니다.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3">고객명</th>
                        <th className="px-4 py-3">연락처</th>
                        <th className="px-4 py-3">공유 받은 대리점장</th>
                        <th className="px-4 py-3">공유 일시</th>
                        <th className="px-4 py-3">상태</th>
                        <th className="px-4 py-3 text-right">관리</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {leads.map((lead) => (
                        <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{lead.customerName}</td>
                            <td className="px-4 py-3 text-gray-600">{lead.customerPhone}</td>
                            <td className="px-4 py-3 text-gray-600">
                                {lead.sharedToManager?.displayName}
                                <span className="text-xs text-gray-400 ml-1">
                                    ({lead.sharedToManager?.User?.mallUserId})
                                </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                                {format(new Date(lead.updatedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                            </td>
                            <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${lead.status === 'NEW' ? 'bg-blue-100 text-blue-700' :
                                        lead.status === 'CONTACTED' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                    }`}>
                                    {lead.status === 'NEW' ? '신규' :
                                        lead.status === 'CONTACTED' ? '접촉' : lead.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                                <button
                                    onClick={() => onRecall(lead.id)}
                                    className="text-red-600 hover:text-red-800 text-xs font-medium border border-red-200 hover:border-red-400 px-2 py-1 rounded transition-colors"
                                >
                                    회수
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
