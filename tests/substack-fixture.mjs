export const wrapFeed = items => `<?xml version="1.0"?><rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel><title>YSM</title>${items}</channel></rss>`;
export const emptyFeed = wrapFeed('');
export const sampleFeed = wrapFeed(Array.from({length:12},(_,i)=>`<item>
  <title><![CDATA[${i===0?'테스트 포스트: 기록을 오래 이어가는 방법':i===1?'긴 제목도 자연스럽게 이어지는지 확인하는 모바일 화면 테스트 포스트':`테스트 포스트 ${i+1}`}]]></title>
  <link>https://tudoryoon.substack.com/p/fixture-${i}</link>
  <dc:creator>YSM</dc:creator><pubDate>${new Date(Date.UTC(2026,8,24-i)).toUTCString()}</pubDate>
  <content:encoded><![CDATA[<p>이 글은 화면 점검용 테스트 데이터입니다. 실제 홈페이지에는 표시되지 않습니다.</p>
    <h2>꾸준히 남기는 기록</h2><p>제목을 선택하면 페이지를 떠나지 않고 본문을 읽을 수 있습니다. 목록 버튼으로 돌아갈 수 있습니다.</p>
    <figure><img src="https://tudoryoon.substack.com/img/substack.png" alt="Substack 테스트 이미지"><figcaption>공개 이미지 렌더링 점검</figcaption></figure>
    ${'<p>모바일에서도 문단과 이미지가 화면 안에 들어가고, 긴 글을 끝까지 스크롤할 수 있는지 확인합니다.</p>'.repeat(8)}
    <blockquote>본문 인용문 표시를 확인합니다.</blockquote><ul><li>첫 번째 항목</li><li>두 번째 항목</li></ul>
    <p><a href="javascript:alert('xss')">실행되지 않는 링크</a></p><script>window.__feedUnsafe=true</script>
  ]]></content:encoded></item>`).join(''));
