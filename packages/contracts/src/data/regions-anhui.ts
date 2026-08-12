import type { RegionNode } from "../region.js";

/**
 * 安徽省行政区树内置数据（规格 §8.1）。
 * 覆盖：省（1）→ 地市（16）→ 区县（代表性子集）→ 乡镇/街道（代表性子集）。
 * 行政区划代码按文本保留前导零。
 * 首版覆盖安徽省全量 16 地市与主要区县；乡镇/街道为代表性子集（后续可扩充）。
 */

export const ANHUI_REGIONS: RegionNode[] = [
  // 省
  { code: "340000", name: "安徽省", level: "province", parentCode: null },
  // 16 地市
  { code: "340100", name: "合肥市", level: "city", parentCode: "340000" },
  { code: "340200", name: "芜湖市", level: "city", parentCode: "340000" },
  { code: "340300", name: "蚌埠市", level: "city", parentCode: "340000" },
  { code: "340400", name: "淮南市", level: "city", parentCode: "340000" },
  { code: "340500", name: "马鞍山市", level: "city", parentCode: "340000" },
  { code: "340600", name: "淮北市", level: "city", parentCode: "340000" },
  { code: "340700", name: "铜陵市", level: "city", parentCode: "340000" },
  { code: "340800", name: "安庆市", level: "city", parentCode: "340000" },
  { code: "341000", name: "黄山市", level: "city", parentCode: "340000" },
  { code: "341100", name: "滁州市", level: "city", parentCode: "340000" },
  { code: "341200", name: "阜阳市", level: "city", parentCode: "340000" },
  { code: "341300", name: "宿州市", level: "city", parentCode: "340000" },
  { code: "341500", name: "六安市", level: "city", parentCode: "340000" },
  { code: "341600", name: "亳州市", level: "city", parentCode: "340000" },
  { code: "341700", name: "池州市", level: "city", parentCode: "340000" },
  { code: "341800", name: "宣城市", level: "city", parentCode: "340000" },
  // 合肥市区县
  { code: "340102", name: "瑶海区", level: "county", parentCode: "340100" },
  { code: "340103", name: "庐阳区", level: "county", parentCode: "340100" },
  { code: "340104", name: "蜀山区", level: "county", parentCode: "340100" },
  { code: "340111", name: "包河区", level: "county", parentCode: "340100" },
  { code: "340121", name: "长丰县", level: "county", parentCode: "340100" },
  { code: "340122", name: "肥东县", level: "county", parentCode: "340100" },
  { code: "340123", name: "肥西县", level: "county", parentCode: "340100" },
  { code: "340124", name: "庐江县", level: "county", parentCode: "340100" },
  // 芜湖市区县
  { code: "340202", name: "镜湖区", level: "county", parentCode: "340200" },
  { code: "340207", name: "鸠江区", level: "county", parentCode: "340200" },
  { code: "340209", name: "弋江区", level: "county", parentCode: "340200" },
  { code: "340221", name: "芜湖县", level: "county", parentCode: "340200" },
  { code: "340222", name: "繁昌县", level: "county", parentCode: "340200" },
  { code: "340223", name: "南陵县", level: "county", parentCode: "340200" },
  { code: "340225", name: "无为市", level: "county", parentCode: "340200" },
  // 蚌埠市
  { code: "340302", name: "龙子湖区", level: "county", parentCode: "340300" },
  { code: "340303", name: "蚌山区", level: "county", parentCode: "340300" },
  { code: "340304", name: "禹会区", level: "county", parentCode: "340300" },
  { code: "340311", name: "淮上区", level: "county", parentCode: "340300" },
  { code: "340321", name: "怀远县", level: "county", parentCode: "340300" },
  { code: "340322", name: "五河县", level: "county", parentCode: "340300" },
  { code: "340323", name: "固镇县", level: "county", parentCode: "340300" },
  // 淮南市
  { code: "340402", name: "大通区", level: "county", parentCode: "340400" },
  { code: "340403", name: "田家庵区", level: "county", parentCode: "340400" },
  { code: "340404", name: "谢家集区", level: "county", parentCode: "340400" },
  { code: "340405", name: "八公山区", level: "county", parentCode: "340400" },
  { code: "340406", name: "潘集区", level: "county", parentCode: "340400" },
  { code: "340421", name: "凤台县", level: "county", parentCode: "340400" },
  // 马鞍山市
  { code: "340503", name: "花山区", level: "county", parentCode: "340500" },
  { code: "340504", name: "雨山区", level: "county", parentCode: "340500" },
  { code: "340506", name: "博望区", level: "county", parentCode: "340500" },
  { code: "340521", name: "当涂县", level: "county", parentCode: "340500" },
  { code: "340523", name: "和县", level: "county", parentCode: "340500" },
  { code: "340522", name: "含山县", level: "county", parentCode: "340500" },
  // 淮北市
  { code: "340603", name: "相山区", level: "county", parentCode: "340600" },
  { code: "340604", name: "烈山区", level: "county", parentCode: "340600" },
  { code: "340602", name: "杜集区", level: "county", parentCode: "340600" },
  { code: "340621", name: "濉溪县", level: "county", parentCode: "340600" },
  // 铜陵市
  { code: "340705", name: "铜官区", level: "county", parentCode: "340700" },
  { code: "340711", name: "郊区", level: "county", parentCode: "340700" },
  { code: "340722", name: "枞阳县", level: "county", parentCode: "340700" },
  // 安庆市
  { code: "340802", name: "迎江区", level: "county", parentCode: "340800" },
  { code: "340803", name: "大观区", level: "county", parentCode: "340800" },
  { code: "340811", name: "宜秀区", level: "county", parentCode: "340800" },
  { code: "340822", name: "怀宁县", level: "county", parentCode: "340800" },
  { code: "340824", name: "潜山市", level: "county", parentCode: "340800" },
  { code: "340825", name: "太湖县", level: "county", parentCode: "340800" },
  { code: "340826", name: "宿松县", level: "county", parentCode: "340800" },
  { code: "340827", name: "望江县", level: "county", parentCode: "340800" },
  { code: "340828", name: "岳西县", level: "county", parentCode: "340800" },
  { code: "340881", name: "桐城市", level: "county", parentCode: "340800" },
  // 黄山市
  { code: "341002", name: "屯溪区", level: "county", parentCode: "341000" },
  { code: "341003", name: "黄山区", level: "county", parentCode: "341000" },
  { code: "341004", name: "徽州区", level: "county", parentCode: "341000" },
  { code: "341021", name: "歙县", level: "county", parentCode: "341000" },
  { code: "341022", name: "休宁县", level: "county", parentCode: "341000" },
  { code: "341023", name: "黟县", level: "county", parentCode: "341000" },
  { code: "341024", name: "祁门县", level: "county", parentCode: "341000" },
  // 滁州市
  { code: "341102", name: "琅琊区", level: "county", parentCode: "341100" },
  { code: "341103", name: "南谯区", level: "county", parentCode: "341100" },
  { code: "341122", name: "来安县", level: "county", parentCode: "341100" },
  { code: "341124", name: "全椒县", level: "county", parentCode: "341100" },
  { code: "341125", name: "定远县", level: "county", parentCode: "341100" },
  { code: "341126", name: "凤阳县", level: "county", parentCode: "341100" },
  { code: "341181", name: "天长市", level: "county", parentCode: "341100" },
  { code: "341182", name: "明光市", level: "county", parentCode: "341100" },
  // 阜阳市
  { code: "341202", name: "颍州区", level: "county", parentCode: "341200" },
  { code: "341203", name: "颍东区", level: "county", parentCode: "341200" },
  { code: "341204", name: "颍泉区", level: "county", parentCode: "341200" },
  { code: "341221", name: "临泉县", level: "county", parentCode: "341200" },
  { code: "341222", name: "太和县", level: "county", parentCode: "341200" },
  { code: "341225", name: "阜南县", level: "county", parentCode: "341200" },
  { code: "341226", name: "颍上县", level: "county", parentCode: "341200" },
  { code: "341282", name: "界首市", level: "county", parentCode: "341200" },
  // 宿州市
  { code: "341302", name: "埇桥区", level: "county", parentCode: "341300" },
  { code: "341321", name: "砀山县", level: "county", parentCode: "341300" },
  { code: "341322", name: "萧县", level: "county", parentCode: "341300" },
  { code: "341323", name: "灵璧县", level: "county", parentCode: "341300" },
  { code: "341324", name: "泗县", level: "county", parentCode: "341300" },
  // 六安市
  { code: "341502", name: "金安区", level: "county", parentCode: "341500" },
  { code: "341503", name: "裕安区", level: "county", parentCode: "341500" },
  { code: "341504", name: "叶集区", level: "county", parentCode: "341500" },
  { code: "341522", name: "霍邱县", level: "county", parentCode: "341500" },
  { code: "341523", name: "舒城县", level: "county", parentCode: "341500" },
  { code: "341524", name: "金寨县", level: "county", parentCode: "341500" },
  { code: "341525", name: "霍山县", level: "county", parentCode: "341500" },
  // 亳州市
  { code: "341602", name: "谯城区", level: "county", parentCode: "341600" },
  { code: "341621", name: "涡阳县", level: "county", parentCode: "341600" },
  { code: "341622", name: "蒙城县", level: "county", parentCode: "341600" },
  { code: "341623", name: "利辛县", level: "county", parentCode: "341600" },
  // 池州市
  { code: "341702", name: "贵池区", level: "county", parentCode: "341700" },
  { code: "341721", name: "东至县", level: "county", parentCode: "341700" },
  { code: "341722", name: "石台县", level: "county", parentCode: "341700" },
  { code: "341723", name: "青阳县", level: "county", parentCode: "341700" },
  // 宣城市
  { code: "341802", name: "宣州区", level: "county", parentCode: "341800" },
  { code: "341821", name: "郎溪县", level: "county", parentCode: "341800" },
  { code: "341823", name: "泾县", level: "county", parentCode: "341800" },
  { code: "341824", name: "绩溪县", level: "county", parentCode: "341800" },
  { code: "341825", name: "旌德县", level: "county", parentCode: "341800" },
  { code: "341881", name: "宁国市", level: "county", parentCode: "341800" },
  { code: "341882", name: "广德市", level: "county", parentCode: "341800" },
  // 合肥市乡镇/街道（代表性子集）
  { code: "340102001", name: "明光路街道", level: "town", parentCode: "340102" },
  { code: "340102002", name: "胜利路街道", level: "town", parentCode: "340102" },
  { code: "340103001", name: "逍遥津街道", level: "town", parentCode: "340103" },
  { code: "340111001", name: "大圩镇", level: "town", parentCode: "340111" },
];
