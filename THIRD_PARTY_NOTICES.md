# 来源与许可

## 角色形象、衣装、贴图和动作参考

「溟月」原型来自上善无形。女仆鲸鱼娘／DeepSeek 版本由 ZipZipPipe 设计。此仓库中的大肥鱼为基于这些设计的三维演绎，制作中包含重新建模、分体服装与物理花边、动作采样及 UV 图像投影。共享角色形象、服装参考图、角色图集、衣柜镜像、动作参考数据和含角色的 GLB 时，请保留此署名、标注修改，遵循 CC BY-NC-SA 4.0 的非商业与相同方式共享要求。[原型作者](https://space.bilibili.com/4456176) · [版本设计者](https://space.bilibili.com/4168597) · [设计说明](https://www.bilibili.com/opus/1247156596114456581) · [许可全文](licenses/CC-BY-NC-SA-4.0.txt)

八张衣柜设定图由项目维护者提供，涵盖默认女仆装及七套换装。本项目依照设定补做了各款的立体裁片、镶边、着装镜像和动作。

动作与部分外观表面的采样参考 shenshen 桌宠 4.2.1，安装包登记的发布者为 merzlin。本地 4.2.1 的“待机呼吸休闲.webm”与上游同名文件的 Git blob 均为 fd64a428a2be1d3b4ff6cd7f9867dfe978ba0bbb。公开可核查的桌宠上游是 PC2005-cloud/dsh-pet。该项目区分程序代码与角色形象的授权。其程序的 MIT 版权声明为 Copyright (c) 2026 PC2005-cloud。[上游项目](https://github.com/PC2005-cloud/dsh-pet) · [MIT 原文](licenses/DSH-Pet-MIT.txt)

基础脸部与后发的早期投影另参考了维护者提供的草地转身动图。原图为 258 × 458、122 帧的 GIF，SHA-256 为 `ba270f4bbf2858a8c0ec35165bc487480ac57f25bef175f6de16571464e8c110`。目前无法从附件确认这张动图的制作者。公开工程包含完成的角色图集和投影脚本，原始动图单独保存在维护者的本地素材库。

## 小屋、院落和工具

房间场景以 menglimi 及贡献者的 astrbot_plugin_private_companion 为基础。六个 `home-room-*` 模块对应的上游文件在 v7.1.6 与 v7.1.20 两标签下逐个具有相同的 Git blob ID。v7.1.20 收录 AGPL-3.0 许可原文。本项目在这些代码上扩展了角色、房间和院落，并改编了独立网页入口及导出接口。场景源码与本仓库的构建工具采用 AGPL-3.0。在网络上运行修改版本时也应遵守该许可中提供对应源代码的条款。[上游的六个房间模块](https://github.com/menglimi/astrbot_plugin_private_companion/tree/e0102767ee452d7561f5d815bc6b9b9847501277/pages/陪伴小屋/assets/voxel-source/panels) · [许可原文](LICENSE)

独立构建使用下列依赖。确切版本和下载完整性记录见 package-lock.json。

| 依赖 | 作用 | 许可 |
| --- | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | WebGL 渲染、OrbitControls 和 GLTFExporter | [MIT](licenses/three-LICENSE.txt) |
| [esbuild](https://github.com/evanw/esbuild) | 浏览器模块打包 | [MIT](licenses/esbuild-LICENSE.txt) |
| [Playwright](https://github.com/microsoft/playwright) | 无头浏览器渲染、模型导出、端到端检查 | [Apache-2.0](licenses/playwright-LICENSE.txt) |

Playwright 下载的浏览器由各自项目分发。此仓库提供安装命令和运行工具，仓库中无需携带浏览器二进制文件。
