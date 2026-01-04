from fastapi import FastAPI
from pydantic import BaseModel
from web3 import Web3
from typing import List, Optional

app = FastAPI()

# 定义前端传过来的数据格式
class MonitorRequest(BaseModel):
    token_address: str
    root_addresses: List[str]
    lookback_days: int = 3
    rpc_url: str = "https://bsc-testnet.publicnode.com" # 默认测试网

# ================= 核心逻辑复用 =================

# 将 Web3 初始化放在函数内部，防止冷启动问题
def get_web3(rpc_url):
    return Web3(Web3.HTTPProvider(rpc_url))

def fetch_data(w3, token_address, root_addrs, days):
    # 基础配置
    PANCAKE_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73"
    WBNB_ADDR = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"
    TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
    
    factory_contract = w3.eth.contract(address=PANCAKE_FACTORY, abi='[{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"getPair","outputs":[{"internalType":"address","name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"}]')
    token_checksum = w3.to_checksum_address(token_address)
    
    # 结果容器
    results = []
    
    # 辅助：判断有效性
    def is_valid_target(address):
        addr = w3.to_checksum_address(address)
        code = w3.eth.get_code(addr)
        if code != b'':
            try:
                pair = factory_contract.functions.getPair(token_checksum, w3.to_checksum_address(WBNB_ADDR)).call()
                if pair == addr: return False, "❌ 卖出 (Swap)"
            except: pass
            return False, "⚠️ 合约/路由"
        return True, "✅ 钱包"

    # 递归函数 (改为收集数据而非打印)
    def recursive_scan(from_addrs, start, end, depth, visited):
        if depth > 2: return # 硬编码最大层级为2，防止超时
        
        # 过滤已访问
        to_scan = [w3.to_checksum_address(a) for a in from_addrs if w3.to_checksum_address(a) not in visited]
        for a in to_scan: visited.add(a)
        
        if not to_scan: return

        # 构造 Topic
        topics = [TRANSFER_TOPIC, [a.replace("0x", "0x000000000000000000000000") for a in to_scan], None]
        
        # 扫描区块 (为了Vercel不超时，建议减少chunk或天数)
        # 简单起见，这里简化了分块逻辑，实际生产需要更健壮的分块
        try:
            logs = w3.eth.get_logs({
                'fromBlock': start, 'toBlock': end,
                'address': token_checksum, 'topics': topics
            })
        except Exception as e:
            return # 忽略错误

        next_layer = set()
        
        for log in logs:
            from_addr = w3.to_checksum_address("0x" + log['topics'][1].hex()[-40:])
            to_addr = w3.to_checksum_address("0x" + log['topics'][2].hex()[-40:])
            amount = int(log['data'].hex(), 16) / 10**18 
            
            if amount < 100: continue # 硬编码最小金额，建议也做成参数

            valid, desc = is_valid_target(to_addr)
            is_new = to_addr not in visited
            
            # === 将结果存入列表 ===
            results.append({
                "depth": depth,
                "from": from_addr,
                "to": to_addr,
                "amount": round(amount, 2),
                "desc": desc,
                "is_new": is_new
            })

            if valid and is_new:
                next_layer.add(to_addr)
        
        if next_layer:
            recursive_scan(list(next_layer), start, end, depth + 1, visited)

    # 启动
    current_block = w3.eth.block_number
    start_block = current_block - (28800 * days)
    visited_set = set()
    
    recursive_scan(root_addrs, start_block, current_block, 0, visited_set)
    return results

# ================= API 路由 =================

@app.post("/api/track")
def track_tokens(req: MonitorRequest):
    try:
        w3 = get_web3(req.rpc_url)
        if not w3.is_connected():
            return {"error": "无法连接 RPC 节点"}
            
        data = fetch_data(w3, req.token_address, req.root_addresses, req.lookback_days)
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}