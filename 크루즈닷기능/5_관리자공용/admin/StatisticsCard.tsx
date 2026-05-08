interface Props {
  title: string;
  value: number;
  color: 'blue' | 'green' | 'red' | 'amber';
  icon: string;
  percentage?: string | number;
}

export default function StatisticsCard({ title, value, color, icon, percentage }: Props) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const textColorClasses = {
    blue: 'text-blue-900',
    green: 'text-green-900',
    red: 'text-red-900',
    amber: 'text-amber-900',
  };

  return (
    <div className={`${colorClasses[color]} rounded-lg border p-4 md:p-6 transition-transform hover:scale-105`}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`text-xs md:text-sm font-medium opacity-75 ${textColorClasses[color]}`}>
            {title}
          </p>
          <p className={`text-2xl md:text-3xl font-bold mt-2 ${textColorClasses[color]}`}>
            {value.toLocaleString('ko-KR')}
          </p>
          {percentage && (
            <p className={`text-xs md:text-sm mt-1 opacity-75 ${textColorClasses[color]}`}>
              {percentage}%
            </p>
          )}
        </div>
        <div className="text-3xl md:text-4xl ml-2 flex-shrink-0">{icon}</div>
      </div>
    </div>
  );
}
