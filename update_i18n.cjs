const fs = require('fs');

const addZenKeys = (filePath, isKo) => {
  const content = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(content);

  data.zen_target_panel = {
    scroll_of_karma: isKo ? "업보의 두루마리" : "Scroll of Karma",
    method_of_sealing: isKo ? "봉인 방식" : "Method of Sealing",
    seal_this_domain: isKo ? "방식을 적용하려면 이 도메인을 봉인하세요" : "Seal this domain to apply methods",
    today_ink: isKo ? "오늘의 먹물" : "Today's Ink",
    daily_average: isKo ? "일일 평균" : "Daily Average",
    peak_temptation: isKo ? "유혹의 정점" : "Peak Temptation",
    karma_score: isKo ? "업보 점수" : "Karma Score",
    days_of_temptation: isKo ? "유혹에 빠진 날" : "Days of Temptation",
    unbroken_seal: isKo ? "온전한 봉인" : "Unbroken Seal",
    peak_hour: isKo ? "정점 시간" : "Peak Hour",
    inner_boundary_cap: isKo ? "내면의 한계선" : "Inner Boundary Cap",
    oath_is_bound: isKo ? "혈계가 맺어짐" : "Oath is Bound",
    oath_can_be_altered: isKo ? "암호를 사용하여 혈계를 변경할 수 있습니다" : "Oath can be altered using passcode",
    remaining: isKo ? "남음" : "remaining",
    policy_std: isKo ? "일반 (Std)" : "Std (일반)",
    policy_multi: isKo ? "다중 (Multi)" : "Multi (다중)",
    policy_oath: isKo ? "혈계 (Oath)" : "Oath (혈계)",
    habit_label: isKo ? "습관" : "Habit",
    daily_label: isKo ? "일간" : "Daily",
    weekly_label: isKo ? "주간" : "Weekly",
    select_prompt: isKo ? "대상의 상태를 확인할 수 있도록 선택하세요." : "Select a target to inspect its state."
  };

  fs.writeFileSync(filePath, JSON.stringify(data, null, 4), 'utf8');
  console.log(`Updated ${filePath}`);
};

addZenKeys('src/i18n/locales/en/sites.json', false);
addZenKeys('src/i18n/locales/ko/sites.json', true);
