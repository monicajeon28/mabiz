#!/usr/bin/env python3
import os
import re
import json
from pathlib import Path
from collections import defaultdict

API_DIR = r"D:\mabiz-crm\src\app\api"
LIB_DIR = r"D:\mabiz-crm\src\lib"

# 모든 @/lib 파일 매핑 (정확한 파일 경로 및 export 확인)
lib_exports = {}

for root, dirs, files in os.walk(LIB_DIR):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            file_path = os.path.join(root, file)
            rel_path = os.path.relpath(file_path, LIB_DIR)
            module_name = rel_path.replace('\\', '/').replace('.ts', '').replace('.tsx', '')

            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                exports = re.findall(r'export\s+(?:function|const|class|interface|type|default)\s+(\w+)', content)
                lib_exports[f"@/lib/{module_name}"] = {
                    'file': file_path,
                    'exports': exports
                }

# 모든 route.ts 검사
issues = defaultdict(list)
total_routes = 0
checked_routes = 0

for root, dirs, files in os.walk(API_DIR):
    for file in files:
        if file == "route.ts":
            file_path = os.path.join(root, file)
            total_routes += 1

            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    checked_routes += 1

                    # 모든 import 문 추출
                    imports = re.findall(r'import\s+(?:{([^}]+)}|(\w+))\s+from\s+["\']([^"\']+)["\']', content)

                    for named_imports, default_import, module_path in imports:
                        if module_path.startswith('@/lib'):
                            import_list = named_imports.split(',') if named_imports else [default_import]
                            import_list = [i.strip() for i in import_list if i.strip()]

                            # prisma의 경우 특수 처리 (named vs default)
                            if 'prisma' in module_path.lower():
                                if '{' in content[:content.find('prisma')] or named_imports:
                                    # named import 시도
                                    if module_path == '@/lib/prisma':
                                        issues['prisma_named_import'].append(file_path)

                            # 모듈 존재 여부 확인
                            if module_path not in lib_exports:
                                issues['missing_module'].append({
                                    'route': file_path,
                                    'import': module_path,
                                    'names': import_list
                                })
                            else:
                                # 실제 export 확인
                                available_exports = lib_exports[module_path]['exports']
                                for import_name in import_list:
                                    if import_name not in available_exports:
                                        issues['missing_export'].append({
                                            'route': file_path,
                                            'module': module_path,
                                            'name': import_name,
                                            'available': available_exports
                                        })

            except Exception as e:
                issues['read_error'].append({
                    'file': file_path,
                    'error': str(e)
                })

# 결과 출력
print(f"총 route.ts 파일: {total_routes}, 검사됨: {checked_routes}")
print(f"\n=== ISSUE SUMMARY ===\n")

for category, items in sorted(issues.items()):
    print(f"\n[{category.upper()}]: {len(items)} issues")
    if category == 'prisma_named_import':
        for f in items[:5]:
            print(f"  - {f}")
    elif category == 'missing_module':
        for item in items[:5]:
            print(f"  - {item['route']}")
            print(f"    Import: {item['import']}")
    elif category == 'missing_export':
        for item in items[:5]:
            route_name = os.path.relpath(item['route'], API_DIR)
            print(f"  - {route_name}")
            print(f"    Cannot find '{item['name']}' in {item['module']}")
            print(f"    Available: {item['available'][:3]}...")
    elif category == 'read_error':
        for item in items[:3]:
            print(f"  - {item['file']}: {item['error']}")

# 상세 리포트 저장
report = {
    'summary': {
        'total_routes': total_routes,
        'checked': checked_routes,
        'issues_by_type': {k: len(v) for k, v in issues.items()}
    },
    'issues': {
        'prisma_named_import': issues.get('prisma_named_import', [])[:20],
        'missing_module': issues.get('missing_module', [])[:20],
        'missing_export': [
            {
                'route': os.path.relpath(i['route'], API_DIR),
                'module': i['module'],
                'missing_name': i['name'],
                'available': i['available']
            }
            for i in issues.get('missing_export', [])[:20]
        ]
    }
}

with open(r'D:\mabiz-crm\AUDIT_ROUTES_IMPORT_ISSUES.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print(f"\n자세한 리포트: D:\\mabiz-crm\\AUDIT_ROUTES_IMPORT_ISSUES.json")
