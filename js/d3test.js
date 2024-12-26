// 设置地图尺寸
const width = 1260;
const height = 900;

// 添加 remap 函数，用于重新映射值的范围
function remap(value, oldMin, oldMax, newMin, newMax) {
    // 处理边界情况
    if (oldMin === oldMax) return newMin;
    if (value <= oldMin) return newMin;
    if (value >= oldMax) return newMax;

    // 线性映射
    return ((value - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
}

// 创建SVG容器
const svg = d3
    .select("#map")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

let projection; // 声明为全局变量以便在drawStream中使用

// 添加全局变量来存储原始流量数据
let globalFlows = [];

// 在文件顶部添加全局 centerPoints
const centerPoints = new Map();

function drawMapBorough(geojson, flows) {
    // 获取地理范围
    const bounds = d3.geoBounds(geojson);

    // 修正坐标轴顺序 [x, y]
    const bngBounds = {
        minX: Math.min(bounds[0][0], bounds[1][0]),
        minY: Math.min(bounds[0][1], bounds[1][1]),
        maxX: Math.max(bounds[0][0], bounds[1][0]),
        maxY: Math.max(bounds[0][1], bounds[1][1])
    };

    // 创建投影，使用英国国家网格坐标系
    projection = d3.geoIdentity()
        .reflectY(true)
        .fitSize([width, height], geojson); // 直接使用原始 geojson

    // 创建路径生成器
    const path = d3.geoPath().projection(projection);

    // 绘制地图路径
    svg.append("g")
        .attr("class", "boroughs")
        .selectAll("path")
        .data(geojson.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("fill", "#f0f0f7")
        .attr("stroke", "#999")
        .attr("cursor", "pointer")
        .on("click", function(event, d) {
            // 处理区域选择
            const selectedId = d.properties.lsoa21cd;
            updateSelection(selectedId, geojson, flows);

            // 更新区域样式
            d3.selectAll(".boroughs path")
                .attr("fill", f => f.properties.lsoa21cd === selectedId ? "#ffeb3b" : "#f0f0f7");
        })
        .on("contextmenu", function(event, d) {
            // 阻止默认的右键菜单
            event.preventDefault();

            // 重置区域颜色
            d3.selectAll(".boroughs path")
                .attr("fill", "#f0f0f7");

            // 显示所有流线
            updateSelection(null, geojson, flows);
        });

    // 添加右键说明
    svg.append("text")
        .attr("class", "instruction")
        .attr("x", width - 20)
        .attr("y", 30)
        .attr("text-anchor", "end")
        .style("font-size", "12px")
        .style("fill", "#666")
        .text("Right click to reset selection");

    // 计算中心点
    geojson.features.forEach(feature => {
        try {
            // 使用 d3.geoCentroid 计算中心点
            const centroid = d3.geoCentroid(feature);
            if (!centroid.some(isNaN)) {
                const id = feature.properties.lsoa21cd;
                centerPoints.set(id, centroid);
            }
        } catch (error) {
            console.warn("Error calculating centroid for feature:", feature);
        }
    });

    console.log("BNG Bounds:", bngBounds);
}

// 修改更新图例函数
function updateLegend(flows, svg, flowRange = null) {
    const legendWidth = 240;
    const legendHeight = 40;

    // 移除现有图例和渐变
    svg.select(".legend").remove();
    svg.select("defs").remove();

    // 如果没有流量数据，不显示图例
    if (!flows || flows.length === 0) return;

    const legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(20, ${height - legendHeight - 20})`);

    // 获取当前流量的范围
    const minFlow = flowRange ? flowRange.minFlow : d3.min(flows, d => d.od_size);
    const maxFlow = flowRange ? flowRange.maxFlow : d3.max(flows, d => d.od_size);

    // 创建颜色比例尺 - 直接使用 scaleSequentialLog
    const colorScale = d3.scaleSequentialLog()
        .domain([minFlow, maxFlow])
        .interpolator(d3.interpolateYlOrRd)
        .clamp(true); // 确保值被限制在范围内

    // 创建 defs 和渐变
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient")
        .attr("id", "flow-gradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    // 生成渐变停止点的值 - 使用更多的点来获得平滑的渐变
    const steps = 100;
    const values = d3.range(steps + 1).map(i => {
        const t = i / steps;
        return d3.quantile(flows, t, d => d.od_size);
    }).filter(d => d !== undefined);

    // 添加渐变停止点
    values.forEach((value, i) => {
        linearGradient.append("stop")
            .attr("offset", `${(i / (values.length - 1)) * 100}%`)
            .attr("stop-color", colorScale(value));
    });

    // 绘制图例矩形
    legend.append("rect")
        .attr("width", legendWidth)
        .attr("height", 10)
        .style("fill", "url(#flow-gradient)")
        .style("stroke", "#ccc")
        .style("stroke-width", 0.5);

    // 创建对数刻度
    const logScale = d3.scaleLog()
        .domain([minFlow, maxFlow])
        .range([0, legendWidth])
        .nice();

    // 生成适当的刻度值
    const tickCount = 5;
    const ticks = logScale.ticks(tickCount)
        .filter(tick => tick >= minFlow && tick <= maxFlow);

    const legendAxis = d3.axisBottom(logScale)
        .tickValues(ticks)
        .tickFormat(d => {
            if (d >= 1000000) return `${(d/1000000).toFixed(1)}M`;
            if (d >= 1000) return `${(d/1000).toFixed(1)}k`;
            return d.toFixed(0);
        });

    legend.append("g")
        .attr("transform", "translate(0, 10)")
        .call(legendAxis);

    // 添加标题
    legend.append("text")
        .attr("x", 0)
        .attr("y", -5)
        .style("font-size", "12px")
        .text(`Flow Volume (${minFlow.toFixed(0)} - ${maxFlow.toFixed(0)})`);

    return colorScale;
}

// 修改 drawStream 函数
function drawStream(flows, geojson, flowRange = null) {
    // 修改计算中心点的逻辑
    geojson.features.forEach(feature => {
        try {
            // 使用 d3.geoPath().centroid() 来计算中心点
            const centroid = path.centroid(feature);
            if (!isNaN(centroid[0]) && !isNaN(centroid[1])) {
                const id = feature.properties.lsoa21cd;
                centerPoints.set(id, centroid);
            }
        } catch (error) {
            // console.warn("Error calculating centroid for feature:", feature);
        }
    });

    // 创建流线组
    const streamGroup = svg.append("g")
        .attr("class", "streams");

    // 更新图例并获取颜色比例尺
    const colorScale = updateLegend(flows, svg, flowRange);

    // 创建宽度比例尺
    const widthScale = d3.scaleSqrt()
        .domain([0, d3.max(flows, d => d.od_size)])
        .range([0.5, 4]);

    // 绘制流线
    const streams = streamGroup.selectAll("path")
        .data(flows)
        .enter()
        .append("path")
        .attr("d", d => {
            const source = centerPoints.get(d.source);
            const target = centerPoints.get(d.target);

            if (!source || !target) {
                return null;
            }

            // 不需要再次投影，因为我们已经有了投影后的坐标
            const sourcePoint = source;
            const targetPoint = target;

            // 计算控制点
            const dx = targetPoint[0] - sourcePoint[0];
            const dy = targetPoint[1] - sourcePoint[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            const midPoint = [
                sourcePoint[0] + dx / 2,
                sourcePoint[1] + dy / 2 - dist / 3
            ];

            return `M${sourcePoint[0]},${sourcePoint[1]}
                    Q${midPoint[0]},${midPoint[1]}
                    ${targetPoint[0]},${targetPoint[1]}`;
        })
        .filter(d => d !== null)
        .attr("fill", "none")
        .attr("stroke", d => colorScale(d.od_size))
        .attr("stroke-width", d => widthScale(d.od_size))
        .attr("stroke-linecap", "round")
        .attr("stroke-opacity", 0.7) // 调整默认不透明度
        .on("mouseover", function(event, d) {
            d3.select(this)
                .attr("stroke-opacity", 1)
                .attr("stroke-width", w => widthScale(w.od_size) * 2)
                .raise();

            // 更强的对比
            streamGroup.selectAll("path")
                .filter(p => p !== d)
                .attr("stroke-opacity", 0.15);

            showFlowInfo(d);
        })
        .on("mouseout", function(event, d) {
            streamGroup.selectAll("path")
                .attr("stroke-opacity", 0.7)
                .attr("stroke-width", w => widthScale(w.od_size));

            hideFlowInfo();
        });
}

// 显示流量信息的函数
function showFlowInfo(flow) {
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "rgba(255, 255, 255, 0.95)")
        .style("padding", "8px 12px")
        .style("border", "1px solid #ddd")
        .style("border-radius", "4px")
        .style("box-shadow", "2px 2px 6px rgba(0, 0, 0, 0.1)")
        .style("pointer-events", "none")
        .style("font-size", "12px")
        .style("opacity", 0);

    tooltip.html(`
        <div style="margin-bottom: 4px"><strong>Flow Details</strong></div>
        <div>From: ${flow.source}</div>
        <div>To: ${flow.target}</div>
        <div>Volume: ${Math.round(flow.od_size)}</div>
    `)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 10) + "px")
        .transition()
        .duration(200)
        .style("opacity", 1);
}

function hideFlowInfo() {
    d3.selectAll(".tooltip").remove();
}

// 添加选择更新函数
function updateSelection(selectedId, geojson, flows) {
    // 过滤出与选中区域相关的流
    const relatedFlows = selectedId ?
        flows.filter(flow => flow.source === selectedId || flow.target === selectedId) :
        flows;

    // 获取当前视图的流量范围
    const currentMinFlow = d3.min(relatedFlows, d => d.od_size);
    const currentMaxFlow = d3.max(relatedFlows, d => d.od_size);

    // 移除现有的流线
    svg.select(".streams").remove();

    // 绘制新的流线
    drawStream(relatedFlows, geojson, {
        minFlow: currentMinFlow,
        maxFlow: currentMaxFlow
    });
}

// 修改初始化函数
async function init() {
    // 加载GeoJSON数据
    const geojson = await d3.json("data/lsoa_london_2021.min.geojson");

    // 加载并解析流量数据
    const flowsText = await d3.text("data/flows.json");
    globalFlows = flowsText
        .trim()
        .split("\n")
        .map(line => JSON.parse(line))
        .sort((a, b) => b.od_size - a.od_size)
        .slice(0, 50000);

    // 传递 flows 到 drawMapBorough
    drawMapBorough(geojson, globalFlows);
    drawStream(globalFlows, geojson);
}

// 启动用
init();