"use client";
import { useState } from 'react';

export default function Home() {
  // 默认填好一些测试数据，方便你直接点
  const [token, setToken] = useState('0x9490b2170bF2473Ec739BEFb95f728f5E4098aa0');
  const [roots, setRoots] = useState('0xB92D0e3459f8226186Ffb8Cf175b561F0EBE03A1');
  const [days, setDays] = useState(0.5); // 默认半天，防止超时
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);

  const handleScan = async () => {
    setLoading(true);
    setLogs([]); // 清空旧数据
    try {
      // 这里的 /api/track 就是你在 api/index.py 里写的那个函数
      const res = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token_address: token.trim(),
          root_addresses: roots.split(',').map(a => a.trim()), // 把逗号分隔的字符串转成列表
          lookback_days: Number(days),
          rpc_url: "https://bsc-testnet.publicnode.com" // 依然用测试网节点
        })
      });
      
      const json = await res.json();
      
      if (json.status === 'success') {
        if (json.data.length === 0) {
          alert("扫描完成，但在指定时间内没有发现转账记录。");
        }
        setLogs(json.data);
      } else {
        alert('后端报错: ' + (json.message || '未知错误'));
      }
    } catch (e) {
      alert('网络请求失败，可能是超时了(Vercel限制10秒)。请尝试减少回溯天数。');
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-200 p-4 md:p-8 font-mono">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 border-b border-slate-800 pb-4">
          <h1 className="text-2xl md:text-3xl font-bold text-green-400 flex items-center gap-2">
            🕵️‍♂️ 链上资金追踪器 <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded">Vercel版</span>
          </h1>
          <p className="text-slate-500 mt-2 text-sm">输入大户地址，自动递归追踪资金去向 (已过滤卖出操作)</p>
        </header>
        
        {/* 输入控制台 */}
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-xl mb-8 space-y-5">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Target Token (代币合约)</label>
            <input 
              value={token} onChange={e => setToken(e.target.value)}
              placeholder="0x..."
              className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-green-300 focus:outline-none focus:border-green-500 transition-colors font-mono"
            />
          </div>
          
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Root Addresses (大户/源头，逗号分隔)</label>
            <textarea 
              value={roots} onChange={e => setRoots(e.target.value)}
              placeholder="0x..., 0x..."
              className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-white h-24 focus:outline-none focus:border-green-500 transition-colors font-mono text-sm"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1">Lookback (回溯天数)</label>
              <input 
                type="number" step="0.1" value={days} onChange={e => setDays(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 p-3 rounded-lg text-white"
              />
              <p className="text-[10px] text-orange-400 mt-1">⚠️ 免费版限制: 建议 &le; 0.5 天</p>
            </div>
            <div className="flex items-end">
              <button 
                onClick={handleScan} disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/20 active:scale-95"
              >
                {loading ? '🔍 全网扫描中...' : '🚀 开始追踪'}
              </button>
            </div>
          </div>
        </div>

        {/* 结果展示区 */}
        <div className="space-y-3">
          {logs.length === 0 && !loading && (
            <div className="text-center py-12 border-2 border-dashed border-slate-800 rounded-xl text-slate-600">
              暂无数据，请点击上方按钮开始追踪
            </div>
          )}
          
          {logs.map((log, idx) => (
            <div key={idx} 
                 className="group relative flex items-center text-sm bg-slate-900/50 hover:bg-slate-800 p-3 rounded-lg border border-slate-800/50 hover:border-slate-700 transition-all" 
                 style={{ marginLeft: `${log.depth * 24}px` }}>
              
              {/* 连接线 */}
              <span className="text-slate-600 mr-3 font-light">
                {log.depth === 0 ? '🔴 根' : '└─>'}
              </span>
              
              <div className="flex-1 overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center gap-1 md:gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 bg-slate-950 px-1 rounded">FROM</span>
                    <span className="text-orange-300 font-mono">{log.from.slice(0,6)}...{log.from.slice(-4)}</span>
                  </div>
                  <span className="hidden md:inline text-slate-600">➜</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 bg-slate-950 px-1 rounded">TO</span>
                    <span className="text-blue-300 font-mono">{log.to.slice(0,6)}...{log.to.slice(-4)}</span>
                    
                    {/* 新地址标记 */}
                    {log.is_new ? (
                      <span className="text-[10px] bg-blue-900/30 text-blue-400 px-1.5 py-0.5 rounded border border-blue-800/50">New</span>
                    ) : (
                      <span className="text-[10px] bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">Loop</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 text-right pl-4 border-l border-slate-800 ml-4">
                <span className="text-emerald-400 font-bold font-mono text-base">{log.amount.toLocaleString()}</span>
                <span className="text-[10px] text-slate-400">{log.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}