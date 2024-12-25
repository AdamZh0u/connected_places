// 声明全局变量
let path;
let names;
let selectedCounty = null;

// 添加 ramp 函数
function ramp(color, n = 256) {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = n;
    canvas.height = 1;

    const x = d3
        .scaleLinear()
        .domain(d3.quantize(d3.interpolate(0, n - 1), color.domain().length))
        .range(color.domain());

    for (let i = 0; i < n; ++i) {
        context.fillStyle = color(x(i));
        context.fillRect(i, 0, 1, 1);
    }
    return canvas;
}

// 添加 remap 函数，用于重新映射颜色值
function remap(value, oldMin, oldMax, newMin, newMax) {
    // 处理边界情况
    if (oldMin === oldMax) return newMin;
    if (value <= oldMin) return newMin;
    if (value >= oldMax) return newMax;

    // 线性映射
    return ((value - oldMin) / (oldMax - oldMin)) * (newMax - newMin) + newMin;
}

// 添加对数变换函数
function logTransform(value, minValue, maxValue) {
    // 确保所有值都是正数，通过将最小值平移到1
    const shift = minValue < 1 ? 1 - minValue : 0;
    const logMin = Math.log(minValue + shift);
    const logMax = Math.log(maxValue + shift);

    // 对输入值进行对数变换
    const logValue = Math.log(value + shift);

    // 将对数值映射到 [0,1] 范围
    return (logValue - logMin) / (logMax - logMin);
}

// 添加图例函数
function legend(color, title = "Flow volume", tickFormat = null) {
    const width = 240;
    const height = 40;
    const marginTop = 16;
    const marginRight = 0;
    const marginBottom = 14;
    const marginLeft = 0;
    const ticks = width / 64;

    const svg = d3
        .select("#legend")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .style("overflow", "visible")
        .style("display", "block");

    let tickAdjust = (g) =>
        g.selectAll(".tick line").attr("y1", marginTop + marginBottom - height);

    const x = d3
        .scaleLinear()
        .domain(color.domain())
        .range([marginLeft, width - marginRight]);

    // 创建渐变色带
    const n = 256;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    canvas.width = n;
    canvas.height = 1;

    // 修改颜色渐变生成方式，使用对数映射
    for (let i = 0; i < n; ++i) {
        const t = i / (n - 1);
        // 使���对数映射获取当前值
        const value = Math.exp(
            d3
            .scaleLinear()
            .domain([0, 1])
            .range([Math.log(color.domain()[0]), Math.log(color.domain()[1])])(t)
        );

        // 应用对数变换和颜色映射
        const logMapped = logTransform(value, color.domain()[0], color.domain()[1]);
        const colorValue = remap(logMapped, 0, 1, 0.2, 0.9);
        context.fillStyle = d3.interpolateBuPu(colorValue);
        context.fillRect(i, 0, 1, 1);
    }

    svg
        .append("image")
        .attr("x", marginLeft)
        .attr("y", marginTop)
        .attr("width", width - marginLeft - marginRight)
        .attr("height", height - marginTop - marginBottom)
        .attr("preserveAspectRatio", "none")
        .attr("xlink:href", canvas.toDataURL());

    svg
        .append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(
            d3
            .axisBottom(x)
            .ticks(ticks)
            .tickFormat(tickFormat || ((d) => d.toFixed(1)))
        )
        .call(tickAdjust)
        .call((g) => g.select(".domain").remove())
        .call((g) =>
            g
            .append("text")
            .attr("x", marginLeft)
            .attr("y", marginTop + marginBottom - height - 6)
            .attr("fill", "currentColor")
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .text(title)
        );
}

async function getNames() {
    const {
        locations: { flat },
    } = await d3.json(
        "https://gist.githubusercontent.com/mbostock/df1b792d76fcb748056ff94b912e4bb8/raw/b1da4894cfb1e56a24129c27b39aa957d7f0c165/names.json"
    );
    const map = new Map(
        Array.from(flat, ({ location_id, name }) => [location_id, name])
    );
    for (const { location_id, parent_id, level, name }
        of flat) {
        if (level === 2) {
            map.set(location_id, `${name}, ${map.get(parent_id)}`);
        }
    }
    return map;
}

// 添加更新信息框的函数
function updateLocationInfo(data = null) {
    if (!data) {
        d3.select("#location-info .info-content")
            .html(`<div class="info-id">&nbsp;</div>
<div class="info-name">Hover over a region</div>
<div class="info-data">to see flow details</div>`);
        return;
    }

    const {
        locationId,
        name,
        totalInflow,
        totalOutflow,
        connectionData,
        flowConnections,
    } = data;

    // 计算连接数量
    const totalConnections = flowConnections ? flowConnections.size : 0;
    const totalFlow = totalInflow + totalOutflow;

    // 格式化数字
    const formatNumber = (num) => {
        if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
        return num.toFixed(0);
    };

    d3.select("#location-info .info-content").html(`
            <div class="info-id">ID: ${locationId}</div>
            <div class="info-name">${name}</div>
            <div class="info-data">
                <div class="flow-summary">
                    <div class="total-flow">
                        <span class="label">Total Flow:</span>
                        <span class="value">${formatNumber(totalFlow)}</span>
                        <span class="count">(${totalConnections} connections)</span>
                    </div>
                    <div class="flow-details">
                        <span class="label">Inflow:</span>
                        <span class="value">${formatNumber(totalInflow)}</span>
                        <span class="label">Outflow:</span>
                        <span class="value">${formatNumber(totalOutflow)}</span>
                    </div>
                    <div class="net-flow">
                        <span class="label">Net Flow:</span>
                        <span class="value ${
                          totalInflow - totalOutflow >= 0
                            ? "positive"
                            : "negative"
                        }">
                            ${
                              totalInflow - totalOutflow >= 0 ? "+" : ""
                            }${formatNumber(totalInflow - totalOutflow)}
                        </span>
                    </div>
                </div>
            </div>`);
}

function createVisualization(
    lsoas_21,
    flowsMap,
    namesMap,
    areaFlowTotals,
    lsoa_connections,
    flows,
    msoa_21
) {
    const width = 1260;
    const height = 900;

    const svg = d3
        .select("#map")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    // 创建自定义投影
    const projection = d3.geoIdentity().reflectY(true).fitSize([width, height], {
        type: "FeatureCollection",
        features: lsoas_21,
    });

    path = d3.geoPath().projection(projection);

    const defaultColor = "#f0f0f7";

    // 预计算最大流量
    const maxTotalFlow = d3.max(flows.map((flow) => flow.od_size));

    // 创建颜色比例尺
    const color = d3
        .scaleSqrt()
        .interpolate(() => d3.interpolateBuPu)
        .domain([0, maxTotalFlow]);

    function updateVisualization(focusId, isSelected = false) {
        const connectionData = lsoa_connections.get(focusId);
        if (connectionData) {
            // 合并流入和流出数据
            const allFlows = new Map();

            // 添加流入数据
            connectionData.inflows.forEach((value, id) => {
                allFlows.set(id, {
                    flow: value,
                    type: "inflow",
                });
            });

            // 添加流出数据
            connectionData.outflows.forEach((value, id) => {
                if (allFlows.has(id)) {
                    // 如果已经有流入，添加到现有记录
                    allFlows.get(id).outflow = value;
                } else {
                    // 如果没有流入，创建新记录
                    allFlows.set(id, {
                        flow: value,
                        type: "outflow",
                    });
                }
            });

            // 获取所有流量值用于比例尺
            const flowValues = Array.from(allFlows.values()).map((d) => d.flow);
            const minFlow = d3.min(flowValues);
            const maxFlow = d3.max(flowValues);

            // 创建颜色插值器函数
            const colorInterpolator = (value) => {
                const logMapped = logTransform(value, minFlow, maxFlow);
                const colorValue = remap(logMapped, 0, 1, 0.2, 0.9);
                return d3.interpolateBuPu(colorValue);
            };

            // 创建新的颜色比例尺用于图例
            const legendScale = d3
                .scaleSequential()
                .domain([minFlow, maxFlow])
                .interpolator(colorInterpolator);

            // 更新图例
            d3.select("#legend").select("svg").remove();
            legend(legendScale, "Flow volume with selected LSOA", (d) =>
                d >= 1000 ? `${(d / 1000).toFixed(1)}k` : d.toFixed(0)
            );

            // 更新所有LSOA区域的颜色
            svg
                .select(".lsoas")
                .selectAll("path")
                .attr("fill", (d) => {
                    const areaId = d.properties.lsoa21cd;
                    if (areaId === focusId) return "#ffff00";

                    if (allFlows.has(areaId)) {
                        const flowData = allFlows.get(areaId);
                        // 使用相同的颜色插值器函数
                        return colorInterpolator(flowData.flow);
                    }
                    return defaultColor;
                });

            // 更新信息框
            updateLocationInfo({
                locationId: focusId,
                name: namesMap.get(focusId),
                totalInflow: connectionData.total_inflow,
                totalOutflow: connectionData.total_outflow,
                connectionData: connectionData,
                flowConnections: allFlows,
            });
        }
    }

    // 绘制LSOA区域
    svg
        .append("g")
        .attr("class", "lsoas")
        .selectAll("path")
        .data(lsoas_21)
        .enter()
        .append("path")
        .attr("fill", (d) => {
            const total = areaFlowTotals.get(d.properties.lsoa21cd);
            return total ? color(total) : defaultColor;
        })
        .attr("d", path)
        .on("click", function(event, d) {
            const feature = d3.select(this).datum();
            const clickedId = feature.properties.lsoa21cd;

            if (selectedCounty === this) {
                // 取消选中
                selectedCounty = null;
                d3.select(this).attr("stroke", null).attr("stroke-width", null).lower();
                updateVisualization(null);
            } else {
                // 选择新区域
                if (selectedCounty) {
                    d3.select(selectedCounty)
                        .attr("stroke", null)
                        .attr("stroke-width", null)
                        .lower();
                }
                selectedCounty = this;
                d3.select(this).attr("stroke", "#000").attr("stroke-width", 2).raise();
                updateVisualization(clickedId, true);
            }
        })
        .on("mouseover", function(event, d) {
            if (this !== selectedCounty) {
                const feature = d3.select(this).datum();
                const locationId = feature.properties.lsoa21cd;

                d3.select(this)
                    .attr("stroke", "#000")
                    .attr("stroke-width", 1.5)
                    .raise();

                updateVisualization(locationId, false);
            }
        })
        .on("mouseout", function(event, d) {
            if (this !== selectedCounty) {
                d3.select(this).attr("stroke", null).lower();

                if (selectedCounty) {
                    const feature = d3.select(selectedCounty).datum();
                    const selectedId = feature.properties.lsoa21cd;
                    updateVisualization(selectedId, true);
                } else {
                    updateVisualization(null);
                }
            }
        });

    // 绘制MSOA边界
    svg
        .append("g")
        .attr("class", "msoa-boundaries")
        .selectAll("path")
        .data(msoa_21.features)
        .enter()
        .append("path")
        .attr("fill", "none")
        .attr("stroke", "#000")
        .attr("stroke-width", 1.5)
        .attr("stroke-opacity", 0.8)
        .attr("d", path);
}

// 加载数据
async function loadData() {
    // 加载 LSOA 地理数据
    const geojson = await d3.json("data/lsoa_london_2021.min.geojson");
    const lsoas_21 = geojson.features;

    // 加载 MSOA 地理数据
    const msoa_21 = await d3.json("data/lad_london_2021.geojson");
    // console.log("Loaded MSOA data:", msoa_21);

    // 加载动数据
    const flowsText = await d3.text("data/flows.json");
    const flows = flowsText
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));

    // 创建区域流量总和的 Map
    const areaFlowTotals = new Map();

    // 初始化每个区域的流量总和为 0
    lsoas_21.forEach((lsoa) => {
        areaFlowTotals.set(lsoa.properties.lsoa21cd, 0);
    });

    // 创建LSOA关联关系的Map
    const lsoa_connections = new Map();
    lsoas_21.forEach((lsoa) => {
        lsoa_connections.set(lsoa.properties.lsoa21cd, {
            outflows: new Map(), // 流出到其他LSOA的流量
            inflows: new Map(), // 从其他LSOA流入的流量
            total_outflow: 0, // 总流出量
            total_inflow: 0, // 总流入量
        });
    });

    // 计算流量和关联关系
    flows.forEach((flow) => {
        const sourceId = flow.source;
        const targetId = flow.target;
        const flowSize = flow.od_size;

        // 更新总流量
        areaFlowTotals.set(
            sourceId,
            (areaFlowTotals.get(sourceId) || 0) + flowSize
        );

        // 更新源LSOA的流出数据
        if (lsoa_connections.has(sourceId)) {
            const sourceData = lsoa_connections.get(sourceId);
            sourceData.outflows.set(targetId, flowSize);
            sourceData.total_outflow += flowSize;
        }

        // 更新目标LSOA的流入数据
        if (lsoa_connections.has(targetId)) {
            const targetData = lsoa_connections.get(targetId);
            targetData.inflows.set(sourceId, flowSize);
            targetData.total_inflow += flowSize;
        }
    });

    return {
        lsoas_21,
        flows,
        areaFlowTotals,
        lsoa_connections,
        msoa_21,
    };
}

async function init() {
    const { lsoas_21, flows, areaFlowTotals, lsoa_connections, msoa_21 } =
    await loadData();

    // 创建流动数据的 Map
    const flowsMap = new Map();
    flows.forEach((flow) => {
        if (!flowsMap.has(flow.source)) {
            flowsMap.set(flow.source, new Map());
        }
        flowsMap.get(flow.source).set(flow.target, flow.od_size);
    });

    // 创建名称 Map
    const namesMap = new Map(
        lsoas_21.map((d) => [d.properties.lsoa21cd, d.properties.LSOA21NM])
    );

    // 修改可视化函数调用，添 flows 参数
    createVisualization(
        lsoas_21,
        flowsMap,
        namesMap,
        areaFlowTotals,
        lsoa_connections,
        flows,
        msoa_21
    );

    function initDraggableInfo() {
        const info = document.getElementById("location-info");
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        info.querySelector(".info-header").addEventListener("mousedown", dragStart);
        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", dragEnd);

        function dragStart(e) {
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;

            if (e.target === info.querySelector(".info-header")) {
                isDragging = true;
            }
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                xOffset = currentX;
                yOffset = currentY;

                setTranslate(currentX, currentY, info);
            }
        }

        function setTranslate(xPos, yPos, el) {
            el.style.transform = `translate(${xPos}px, ${yPos}px)`;
        }

        function dragEnd(e) {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        }
    }

    initDraggableInfo();
}

// 启动应用
init();