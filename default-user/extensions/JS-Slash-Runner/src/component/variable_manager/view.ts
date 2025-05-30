import { POPUP_TYPE, callGenericPopup } from '@sillytavern/scripts/popup';
import { isMobile } from '@sillytavern/scripts/RossAscends-mods';
import { getSortableDelay } from '@sillytavern/scripts/utils';

import { VariableCardFactory } from '@/component/variable_manager/card';
import { IDomUpdater } from '@/component/variable_manager/sync';
import { VariableDataType, VariableItem, VariableType } from '@/component/variable_manager/types';
import { getLastMessageId } from '@/function/util';

export interface IController {
  cleanup(): void;
}

export class VariableView implements IDomUpdater {
  /**
   * 最小浮窗宽度（像素）
   */
  private static readonly MIN_DIALOG_WIDTH = 300;

  /**
   * 最小浮窗高度（像素）
   */
  private static readonly MIN_DIALOG_HEIGHT = 250;

  /**
   * UI容器
   */
  private container: JQuery<HTMLElement>;

  /**
   * 变量卡片
   */
  private cardFactory: VariableCardFactory;

  /**
   * 浮窗元素
   */
  private dialog: JQuery<HTMLElement> | null = null;

  /**
   * 控制器引用
   */
  private controller: IController | null = null;

  /**
   * 是否跳过动画效果的标记
   */
  private _skipAnimation: boolean = false;

  /**
   * 最新渲染请求ID，用于跟踪和取消旧请求
   */
  private _lastRenderRequestId: number = 0;

  /**
   * 构造函数
   * @param container 变量管理器容器
   */
  constructor(container: JQuery<HTMLElement>) {
    this.container = container;
    this.cardFactory = new VariableCardFactory();
  }

  /**
   * 设置控制器引用
   * @param controller 变量控制器
   */
  public setController(controller: IController): void {
    this.controller = controller;
  }

  /**
   * 初始化UI
   */
  public initUI(): void {
    this.container.find('#global-tab').addClass('active');
    this.container.find('#global-content').addClass('active');

    // 初始化时隐藏楼层筛选控件（仅在消息标签页时才显示）
    this.container.find('#floor-filter-container').hide();

    this.initSortable();
    this.initFloorFilter();
  }

  /**
   * 初始化可排序功能
   */
  private initSortable(): void {
    this.container.find('.list-items-container').sortable({
      delay: getSortableDelay(),
      handle: '.drag-handle',
      stop: function (_event, ui) {
        const listContainer = $(ui.item).closest('.list-items-container');

        const items: string[] = [];
        listContainer.find('.variable-content-input').each(function () {
          items.push($(this).val() as string);
        });

        const processedItems = _.uniqBy(items, item => item.trim().toLowerCase());

        if (!_.isEqual(items, processedItems)) {
          listContainer.empty();
          processedItems.forEach(item => {
            const itemHtml = `
              <div class="list-item">
                <span class="drag-handle">☰</span>
                <textarea class="variable-content-input">${item}</textarea>
                <button class="list-item-delete"><i class="fa-solid fa-times"></i></button>
              </div>
            `;
            listContainer.append(itemHtml);
          });
        }

        listContainer.trigger('sortupdate');
      },
    });
  }

  /**
   * 初始化楼层筛选功能
   */
  private initFloorFilter(): void {
    this.container.find('#floor-filter-btn').on('click', () => {
      const minVal = parseInt(this.container.find('#floor-min').val() as string, 10);
      const maxVal = parseInt(this.container.find('#floor-max').val() as string, 10);

      if (isNaN(minVal) || isNaN(maxVal)) {
        this.showFloorFilterError('请输入有效的楼层数值');
        return;
      }

      if (maxVal < minVal) {
        this.showFloorFilterError('最大楼层不能小于最小楼层');
        return;
      }

      this.hideFloorFilterError();
    });

    this.container.find('#floor-min, #floor-max').on('input', () => {
      const minVal = parseInt(this.container.find('#floor-min').val() as string, 10);
      const maxVal = parseInt(this.container.find('#floor-max').val() as string, 10);

      if (!isNaN(minVal) && !isNaN(maxVal) && maxVal < minVal) {
        this.showFloorFilterError('最大楼层不能小于最小楼层');
      } else {
        this.hideFloorFilterError();
      }
    });
  }

  /**
   * 获取UI容器
   * @returns UI容器jQuery对象
   */
  public getContainer(): JQuery<HTMLElement> {
    return this.container;
  }

  /**
   * 显示楼层筛选错误信息
   * @param message 错误信息
   */
  public showFloorFilterError(message: string): void {
    const $errorEl = this.container.find('#floor-filter-error');
    $errorEl.text(message).show();
  }

  /**
   * 隐藏楼层筛选错误信息
   */
  public hideFloorFilterError(): void {
    this.container.find('#floor-filter-error').hide();
  }

  /**
   * 更新楼层筛选输入框的值
   * @param min 最小楼层值
   * @param max 最大楼层值
   */
  public updateFloorRangeInputs(min: number | null, max: number | null): void {
    this.container.find('#floor-min').val(min !== null ? min.toString() : '');
    this.container.find('#floor-max').val(max !== null ? max.toString() : '');
    this.hideFloorFilterError();
  }

  /**
   * 获取指定类型的变量列表容器
   * @param typeOrContent 变量类型或已找到的内容元素
   * @returns 变量列表jQuery对象
   */
  private getOrCreateVariableList(typeOrContent: VariableType | JQuery<HTMLElement>): JQuery<HTMLElement> {
    let $content: JQuery<HTMLElement>;

    if (typeof typeOrContent === 'string') {
      $content = this.container.find(`#${typeOrContent}-content`);
    } else {
      $content = typeOrContent;
    }
    const $variableList = $content.find('.variable-list');
    return $variableList;
  }

  /**
   * 获取当前活动的变量类型
   * @returns 当前活动的变量类型
   */
  private getActiveVariableType(): VariableType {
    return (this.container.find('.tab-item.active').attr('id')?.replace('-tab', '') as VariableType) || 'chat';
  }

  /**
   * 生成唯一的键名
   * @param objectCard 对象卡片jQuery对象
   * @param dataType 数据类型
   * @returns 生成的唯一键名
   */
  private generateUniqueKey(objectCard: JQuery<HTMLElement>, dataType: VariableDataType): string {
    // 获取当前对象值
    const objectValue = this.getVariableCardValue(objectCard);

    // 基于数据类型生成基础键名前缀
    let keyPrefix = '';
    switch (dataType) {
      case 'array':
        keyPrefix = 'array';
        break;
      case 'boolean':
        keyPrefix = 'flag';
        break;
      case 'number':
        keyPrefix = 'num';
        break;
      case 'object':
        keyPrefix = 'obj';
        break;
      case 'string':
        keyPrefix = 'str';
        break;
      default:
        keyPrefix = 'item';
    }

    // 查找同类型已有键的最大索引
    let maxIndex = 0;
    const pattern = new RegExp(`^${keyPrefix}(\\d+)$`);

    for (const key in objectValue) {
      if (Object.prototype.hasOwnProperty.call(objectValue, key)) {
        const match = key.match(pattern);
        if (match) {
          const index = parseInt(match[1], 10);
          if (!isNaN(index) && index > maxIndex) {
            maxIndex = index;
          }
        }
      }
    }

    // 返回新键名
    return `${keyPrefix}${maxIndex + 1}`;
  }

  /**
   * 在对象卡片上添加嵌套变量
   * @param objectCard 对象卡片jQuery对象
   * @param keyName 键名
   * @param dataType 数据类型
   */
  private async addNestedVariableToObject(
    objectCard: JQuery<HTMLElement>,
    keyName: string,
    dataType: VariableDataType,
  ): Promise<void> {
    try {
      // 获取当前对象值
      const objectValue = this.getVariableCardValue(objectCard);
      if (typeof objectValue !== 'object' || objectValue === null) {
        console.error('无效的对象值');
        return;
      }

      // 根据类型创建默认值
      let defaultValue: any;
      switch (dataType) {
        case 'array':
          defaultValue = [];
          break;
        case 'boolean':
          defaultValue = false;
          break;
        case 'number':
          defaultValue = 0;
          break;
        case 'object':
          defaultValue = {};
          break;
        case 'string':
          defaultValue = '';
          break;
      }

      // 添加新键值对
      objectValue[keyName] = defaultValue;

      // 更新对象卡片的值
      const jsonString = JSON.stringify(objectValue, null, 2);
      objectCard.find('.json-input').val(jsonString);
      objectCard.attr('data-value', JSON.stringify(objectValue));

      // 如果处于卡片视图模式，添加嵌套卡片
      if (objectCard.attr('data-view-mode') === 'card') {
        const $container = objectCard.find('.nested-cards-container');

        const $nestedCardWrapper = $(`
          <div class="nested-card-wrapper" data-key="${keyName}">
            <div class="nested-card-content"></div>
          </div>
        `);

        const nestedCard = this.cardFactory.createCard(dataType, keyName, defaultValue);

        // 简化嵌套卡片的外观
        const titleInput = nestedCard.find('.variable-title-container input');
        titleInput.attr('title', '点击编辑键名');
        titleInput.addClass('nested-card-key-input');

        nestedCard.find('.variable-action-btn.save-btn').removeClass('save-btn').addClass('object-save-btn');
        nestedCard.find('.variable-action-btn.delete-btn').removeClass('delete-btn').addClass('object-delete-btn');

        const objectDeleteBtn = nestedCard.find('.variable-action-btn.object-delete-btn');
        objectDeleteBtn.attr('data-nested-key', $nestedCardWrapper.attr('data-key') || '');
        objectDeleteBtn.attr('data-parent-card-id', objectCard.attr('id') || '');

        // 监听嵌套卡片值的变更，同步到父对象
        nestedCard.on('change', '.variable-content-input, .boolean-btn', () => {
          const newValue = this.getVariableCardValue(nestedCard);

          // 更新对象中对应键的值
          objectValue[keyName] = newValue;

          // 更新JSON字符串
          const updatedJsonString = JSON.stringify(objectValue, null, 2);
          objectCard.find('.json-input').val(updatedJsonString);
          objectCard.attr('data-value', JSON.stringify(objectValue));
        });

        // 添加键名点击编辑功能
        titleInput.on('input', function () {
          const $input = $(this);
          const oldKey = $nestedCardWrapper.attr('data-key') || '';
          const newKey = $input.val() as string;

          if (newKey && newKey !== oldKey && oldKey) {
            // 更新键名
            $nestedCardWrapper.attr('data-key', newKey);

            // 获取对象值并更新键名
            const objValue = JSON.parse(objectCard.attr('data-value') || '{}') as Record<string, any>;
            if (objValue[oldKey] !== undefined) {
              objValue[newKey] = objValue[oldKey];
              delete objValue[oldKey];

              // 更新对象卡片的值
              const updatedJsonStr = JSON.stringify(objValue, null, 2);
              objectCard.find('.json-input').val(updatedJsonStr);
              objectCard.attr('data-value', JSON.stringify(objValue));
            }
          }
        });

        // 将卡片添加到容器中
        $nestedCardWrapper.find('.nested-card-content').append(nestedCard);
        $container.append($nestedCardWrapper);

        // 添加动画效果
        if (!this._skipAnimation) {
          this.addAnimation($nestedCardWrapper, 'variable-added', () => {});
        }
      }

      console.log(`已添加键 "${keyName}" 到对象`);
    } catch (error) {
      console.error('添加键值对失败:', error);
    }
  }

  /**
   * 创建并添加变量卡片
   * @param name 变量名称
   * @param value 变量值
   * @param dataType 数据类型（可选，如果不提供则自动推断）
   * @param targetType 目标变量类型（可选，如果不提供则使用当前活动标签页）
   * @param targetContent 目标容器（可选，如果不提供则根据targetType自动获取）
   * @returns 创建的变量卡片jQuery对象
   */
  private createAndAppendCard(
    name: string,
    value: any,
    dataType?: VariableDataType,
    targetType?: VariableType,
    targetContent?: JQuery<HTMLElement>,
  ): JQuery<HTMLElement> {
    // 确定数据类型
    const type = dataType || this.cardFactory.inferDataType(value);

    // 确定目标类型和容器
    const varType = targetType || this.getActiveVariableType();
    const $variableList = targetContent
      ? this.getOrCreateVariableList(targetContent)
      : this.getOrCreateVariableList(varType);

    // 移除空状态提示（如果存在）
    const $emptyState = $variableList.find('.empty-state');
    if ($emptyState.length > 0) {
      $emptyState.remove();
    }

    // 创建变量卡片
    let card: JQuery<HTMLElement>;

    // 对于对象类型，提供类型选择对话框回调
    if (type === 'object') {
      card = this.cardFactory.createCard(type, name, value, callback => this.showVariableTypeDialog(callback));

      card.on('object:addKey', (_event, selectedDataType: VariableDataType) => {
        const keyName = this.generateUniqueKey(card, selectedDataType);
        this.addNestedVariableToObject(card, keyName, selectedDataType);
      });
    } else {
      card = this.cardFactory.createCard(type, name, value);
    }

    this.cardFactory.setCardDataAttributes(card, name, value);

    $variableList.append(card);

    return card;
  }

  /**
   * 设置活动标签页
   * @param type 要激活的变量类型
   */
  public setActiveTab(type: VariableType): void {
    this.container.find('.tab-item').removeClass('active');
    this.container.find('.tab-content').removeClass('active');

    this.container.find(`#${type}-tab`).addClass('active');
    this.container.find(`#${type}-content`).addClass('active');

    const $floorFilterContainer = this.container.find('#floor-filter-container');
    if (type === 'message') {
      $floorFilterContainer.show();
      const [minFloor, maxFloor] = (this.controller as any).model.getFloorRange();

      if (minFloor === null || maxFloor === null) {
        const lastMessageId = getLastMessageId();
        const newMinFloor = Math.max(0, lastMessageId - 4);
        const newMaxFloor = lastMessageId;
        (this.controller as any).model.updateFloorRange(newMinFloor, newMaxFloor);
      }
    } else {
      $floorFilterContainer.hide();
    }
  }

  /**
   * 刷新变量卡片
   * @param type 变量类型
   * @param variables 过滤后的变量列表
   */
  public refreshVariableCards(type: VariableType, variables: VariableItem[]): void {
    // 为每次渲染请求生成唯一ID
    const operationId = Date.now();
    this._lastRenderRequestId = operationId;

    // 更新标签文本
    this.container.find('.variable-type-label').text(`${type}变量`);

    // 获取当前活动的内容容器
    const activeContent = this.container.find(`#${type}-content`);
    const $variableList = this.getOrCreateVariableList(activeContent);

    // 保存滚动位置
    const scrollTop = $variableList.scrollTop() || 0;

    // 清空变量列表
    $variableList.empty();

    // 如果没有变量，显示空状态
    if (variables.length === 0) {
      $variableList.html('<div class="empty-state"><p>暂无变量</p></div>');
      return;
    }

    // 根据变量类型选择不同的渲染方式
    if (type === 'message') {
      this.renderMessageVariablesByFloor($variableList, operationId)
        .then(result => {
          // 如果当前渲染请求已经过时或被取消，不执行后续操作
          if (this._lastRenderRequestId !== operationId || result.cancelled) {
            return;
          }

          // 恢复滚动位置
          $variableList.scrollTop(scrollTop);
        })
        .catch(error => {
          console.error(`[VariableView] 楼层变量渲染出错:`, error);
        });
    } else {
      // 渲染普通变量列表
      this.renderRegularVariables(variables, $variableList);

      // 恢复滚动位置
      $variableList.scrollTop(scrollTop);
    }
  }

  /**
   * 渲染普通变量列表（非楼层分组）
   * @param variables 变量列表
   * @param $container 容器元素
   */
  private renderRegularVariables(variables: VariableItem[], $container: JQuery<HTMLElement>): void {
    // 使用DocumentFragment提高渲染性能
    const fragment = document.createDocumentFragment();

    variables.forEach(variable => {
      const card = this.createAndAppendCard(variable.name, variable.value, variable.type);
      fragment.appendChild(card[0]);
    });

    $container.append(fragment);
  }

  /**
   * 按楼层渲染消息变量
   * @param $container 容器元素
   * @param operationId 操作ID，用于日志追踪
   * @returns 包含渲染结果的Promise，包括是否被取消等信息
   */
  private async renderMessageVariablesByFloor(
    $container: JQuery<HTMLElement>,
    operationId: number = Date.now(),
  ): Promise<{ cancelled: boolean }> {
    try {
      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      const controller = this.controller as any;
      if (!controller || !controller.model) {
        throw new Error('找不到变量模型');
      }

      const minFloor = parseInt(this.container.find('#floor-min').val() as string, 10);
      const maxFloor = parseInt(this.container.find('#floor-max').val() as string, 10);

      if (isNaN(minFloor) || isNaN(maxFloor)) {
        $container.html('<div class="empty-state"><p>请设置有效的楼层范围筛选条件</p></div>');
        return { cancelled: false };
      }

      const scrollTop = $container.scrollTop() || 0;

      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      $container.empty();

      const floorIds: number[] = [];
      for (let id = maxFloor; id >= minFloor; id--) {
        floorIds.push(id);
      }

      if (floorIds.length === 0) {
        $container.html('<div class="empty-state"><p>在当前筛选条件下未找到任何楼层</p></div>');
        return { cancelled: false };
      }

      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      const filterState = controller.model.getFilterState();
      const searchKeyword = controller.model.getSearchKeyword();

      const floorVariablesMap = new Map<number, VariableItem[]>();
      for (const floorId of floorIds) {
        const floorVariables = await this.getFloorVariables(floorId);

        if (this._lastRenderRequestId !== operationId) {
          return { cancelled: true };
        }

        const filteredFloorVariables = floorVariables.filter(variable => {
          const typeFilterPassed = filterState[variable.type];
          if (!typeFilterPassed) return false;

          if (searchKeyword) {
            const keyword = searchKeyword.toLowerCase();
            const nameMatch = variable.name.toLowerCase().includes(keyword);

            let valueMatch = false;
            if (['string', 'text', 'number', 'boolean'].includes(variable.type)) {
              const valueStr = String(variable.value).toLowerCase();
              valueMatch = valueStr.includes(keyword);
            }

            return nameMatch || valueMatch;
          }

          return true;
        });

        floorVariablesMap.set(floorId, filteredFloorVariables);
      }

      const documentFragment = document.createDocumentFragment();
      const $fragmentContainer = $(documentFragment);

      let totalVariablesCount = 0;
      let visibleFloors = 0;
      const $panels: Record<number, JQuery<HTMLElement>> = {};

      for (const floorId of floorIds) {
        const floorVariables = floorVariablesMap.get(floorId) || [];

        if (!floorVariables || floorVariables.length === 0) {
          continue;
        }

        if (this._lastRenderRequestId !== operationId) {
          return { cancelled: true };
        }

        const $floorPanel = await this.createFloorPanel(floorId, false);
        $panels[floorId] = $floorPanel;

        const $panelBody = $floorPanel.find('.floor-panel-body');

        floorVariables.forEach(variable => {
          const card = this.cardFactory.createCard(variable.type, variable.name, variable.value);
          this.cardFactory.setCardDataAttributes(card, variable.name, variable.value);
          $panelBody.append(card);
        });

        $fragmentContainer.append($floorPanel);

        totalVariablesCount += floorVariables.length;
        visibleFloors++;
      }

      if (this._lastRenderRequestId !== operationId) {
        return { cancelled: true };
      }

      $container.append(documentFragment);

      if (Object.keys($panels).length > 0) {
        const maxVisibleFloorId = Math.max(...Object.keys($panels).map(Number));
        const $maxFloorPanel = $panels[maxVisibleFloorId];
        $maxFloorPanel.find('.floor-panel-icon').addClass('expanded');
        $maxFloorPanel.find('.floor-panel-body').addClass('expanded');
      }

      $container.scrollTop(scrollTop);

      if ($container.children().length === 0) {
        $container.html('<div class="empty-state"><p>在当前筛选条件下未找到任何楼层变量</p></div>');
      }

      return { cancelled: false };
    } catch (error: any) {
      console.error(`[VariableView] 渲染楼层变量失败:`, error);
      $container.html(`<div class="empty-state"><p>渲染变量时出错: ${error.message}</p></div>`);
      return { cancelled: false };
    }
  }

  /**
   * 获取指定楼层的变量列表
   * @param floorId 楼层ID
   * @returns 该楼层的变量列表
   */
  private async getFloorVariables(floorId: number): Promise<VariableItem[]> {
    try {
      const controller = this.controller as any;
      if (!controller || !controller.model) {
        throw new Error('找不到变量模型');
      }

      if (typeof controller.model.getFloorVariables === 'function') {
        const floorVariables = controller.model.getFloorVariables(floorId);

        const result: VariableItem[] = [];
        for (const name in floorVariables) {
          const value = floorVariables[name];
          let type: VariableDataType = 'string';

          if (Array.isArray(value)) {
            type = 'array';
          } else if (typeof value === 'boolean') {
            type = 'boolean';
          } else if (typeof value === 'number') {
            type = 'number';
          } else if (typeof value === 'object' && value !== null) {
            type = 'object';
          }

          result.push({
            name,
            type,
            value,
          });
        }

        return result;
      }
      console.warn(`[VariableView] 模型没有获取楼层变量的方法`);
      return [];
    } catch (error) {
      console.error(`[VariableView] 获取楼层${floorId}变量失败:`, error);
      return [];
    }
  }

  /**
   * 创建楼层折叠面板
   * @param floor 楼层号
   * @param isExpanded 是否默认展开
   * @returns 折叠面板jQuery对象
   */
  private async createFloorPanel(floor: number, isExpanded: boolean): Promise<JQuery<HTMLElement>> {
    const titleContent = `# ${floor} 楼`;

    const $panel = $(`
      <div class="floor-panel" data-floor="${floor}">
        <div class="floor-panel-header flex spaceBetween alignItemsCenter">
          <div class="floor-panel-title">${titleContent}</div>
          <div class="floor-panel-icon ${isExpanded ? 'expanded' : ''}">
            <i class="fa-solid fa-chevron-down"></i>
          </div>
        </div>
        <div class="floor-panel-body ${isExpanded ? 'expanded' : ''}"></div>
      </div>
    `);

    $panel.find('.floor-panel-header').on('click', function () {
      const $this = $(this);
      const $icon = $this.find('.floor-panel-icon');
      const $body = $this.closest('.floor-panel').find('.floor-panel-body');

      $icon.toggleClass('expanded');
      $body.toggleClass('expanded');
    });

    return $panel;
  }

  /**
   * 创建新变量卡片
   * @param type 变量类型
   * @param dataType 变量数据类型
   * @param floorId 楼层ID(仅用于message类型)
   */
  public createNewVariableCard(type: VariableType, dataType: VariableDataType, floorId?: number): void {
    const $content = this.container.find(`#${type}-content`);
    $content.find('.empty-state').remove();

    let defaultValue: any;
    switch (dataType) {
      case 'array':
        defaultValue = [];
        break;
      case 'boolean':
        defaultValue = false;
        break;
      case 'number':
        defaultValue = 0;
        break;
      case 'object':
        defaultValue = {};
        break;
      case 'string':
        defaultValue = '';
        break;
      default:
        defaultValue = '';
    }

    const defaultName = 'new_variable';

    // message类型特殊处理
    if (type === 'message' && floorId !== undefined) {
      // 查找或创建楼层面板
      const $floorPanel = $content.find(`.floor-panel[data-floor="${floorId}"]`);

      if ($floorPanel.length === 0) {
        // 创建新的楼层面板
        this.createFloorPanel(floorId, true).then($panel => {
          $content.find('.variable-list').append($panel);

          // 在面板中创建卡片
          const $panelBody = $panel.find('.floor-panel-body');
          const newCard = this.cardFactory.createCard(dataType, defaultName, defaultValue);
          this.cardFactory.setCardDataAttributes(newCard, defaultName, defaultValue);

          // 添加楼层信息用于保存
          newCard.attr('data-floor', floorId.toString());
          newCard.attr('data-type', dataType);
          newCard.attr('data-status', 'new');

          $panelBody.append(newCard);
        });
      } else {
        // 在已有面板中创建卡片
        const $panelBody = $floorPanel.find('.floor-panel-body');

        // 确保面板展开
        if (!$panelBody.hasClass('expanded')) {
          $floorPanel.find('.floor-panel-icon').addClass('expanded');
          $panelBody.addClass('expanded');
        }

        const newCard = this.cardFactory.createCard(dataType, defaultName, defaultValue);
        this.cardFactory.setCardDataAttributes(newCard, defaultName, defaultValue);

        // 添加楼层信息用于保存
        newCard.attr('data-floor', floorId.toString());
        newCard.attr('data-type', dataType);
        newCard.attr('data-status', 'new');

        $panelBody.append(newCard);
      }
    } else {
      // 其他类型变量正常处理
      const newCard = this.createAndAppendCard(defaultName, defaultValue, dataType, type, $content);
      newCard.attr('data-type', dataType);
      newCard.attr('data-status', 'new');
    }
  }

  /**
   * 更新变量卡片
   *
   * @param name 变量名称
   * @param value 变量新值
   * @param isNewCard 可选参数，指示是否为新创建的卡片完成保存
   * @returns 是否找到并更新了卡片
   */
  public updateVariableCard(name: string, value: any, isNewCard: boolean = false): boolean {
    try {
      let cardToUpdate: JQuery<HTMLElement> | undefined = undefined;
      let isNewCardBeingFinalized = false;

      // 优先查找具有 data-status="new" 的卡片
      const $newCardPlaceholder = this.container.find('.variable-card[data-status="new"]');

      if ($newCardPlaceholder.length > 0) {
        cardToUpdate = $newCardPlaceholder;
        isNewCardBeingFinalized = true;
      } else {
        cardToUpdate = this.container.find(`.variable-card[data-name="${name}"]`);
      }

      if (!cardToUpdate || cardToUpdate.length === 0) {
        // 如果卡片既不是 "new" 状态，也找不到对应名称的已存在卡片，则创建新卡片
        this.createAndAppendCard(name, value);
        return true;
      }

      // 如果是正在最终化的新卡片，移除其 'new' 状态
      if (isNewCardBeingFinalized || isNewCard) {
        cardToUpdate.removeAttr('data-status');
        // 设置原始名称，用于后续重命名检测
        cardToUpdate.attr('data-original-name', name);
      }

      let displayValue = JSON.stringify(value);
      if (displayValue.length > 100) {
        displayValue = displayValue.substring(0, 100) + '...';
      }

      const cardType = cardToUpdate.attr('data-type') as VariableDataType;

      let listContainer;
      let jsonString;
      let inputElement;

      switch (cardType) {
        case 'string':
          cardToUpdate.find('.string-input').val(value);
          break;
        case 'number':
          cardToUpdate.find('.number-input').val(value);
          break;
        case 'boolean':
          cardToUpdate.find('.boolean-btn').removeClass('active');
          cardToUpdate.find(`.boolean-btn[data-value="${value}"]`).addClass('active');
          break;
        case 'array':
          listContainer = cardToUpdate.find('.list-items-container');
          listContainer.empty();
          if (Array.isArray(value) && value.length > 0) {
            const itemsHtml = value
              .map(item => {
                // 处理对象类型元素，转换为JSON字符串显示
                let arrayDisplayValue = item;
                if (item !== null && typeof item === 'object') {
                  arrayDisplayValue = JSON.stringify(item, null, 2);
                }

                return `
                <div class="list-item">
                  <span class="drag-handle">☰</span>
                  <textarea class="variable-content-input">${String(arrayDisplayValue)}</textarea>
                  <button class="list-item-delete"><i class="fa-regular fa-times"></i></button>
                </div>
              `;
              })
              .join('');
            listContainer.html(itemsHtml);
          }
          break;
        case 'object':
          jsonString = JSON.stringify(value, null, 2);
          cardToUpdate.find('.json-input').val(jsonString);
          break;
        default:
          inputElement = cardToUpdate.find('.variable-content-input');
          if (inputElement.length > 0) {
            inputElement.val(typeof value === 'object' ? JSON.stringify(value) : value);
          } else {
            console.warn(`[VariableManager] 无法找到输入元素来更新变量值: ${name}`);
          }
      }

      this.cardFactory.setCardDataAttributes(cardToUpdate, name, value);

      if (!this._skipAnimation) {
        // 根据是新卡片还是更新卡片选择不同的动画效果
        const animationClass = isNewCard ? 'variable-added' : 'variable-changed';
        this.addAnimation(cardToUpdate, animationClass, () => {});
      }
      return true;
    } catch (error) {
      console.error(`[VariableManager] 更新变量卡片"${name}"失败:`, error);
      toastr.error(`更新变量卡片"${name}"失败: ${error}`);
      return false;
    }
  }

  /**
   * 获取变量卡片值
   * @param card 卡片元素
   * @returns 卡片中的变量值
   */
  public getVariableCardValue(card: JQuery<HTMLElement>): any {
    const dataType = card.attr('data-type') as VariableDataType;

    switch (dataType) {
      case 'array': {
        const items: any[] = [];
        card.find('.list-item textarea').each(function () {
          let value = $(this).val() as string;

          // 尝试将JSON字符串解析为对象或数组
          if (typeof value === 'string') {
            value = value.trim();
            // 检查是否为JSON对象或数组格式
            if ((value.startsWith('{') && value.endsWith('}')) || (value.startsWith('[') && value.endsWith(']'))) {
              try {
                // 尝试解析JSON字符串
                value = JSON.parse(value);
              } catch (error) {
                // 解析失败时保持原始字符串
                console.log('JSON字符串解析失败，保留原始字符串:', value);
              }
            }
          }

          items.push(value);
        });
        return items;
      }
      case 'boolean': {
        const activeBtn = card.find('.boolean-btn.active');
        return activeBtn.attr('data-value') === 'true';
      }
      case 'number': {
        return Number(card.find('.number-input').val());
      }
      case 'object': {
        try {
          return JSON.parse(card.find('.json-input').val() as string);
        } catch (error) {
          console.error(`[VariableManager] JSON解析错误:`, error);
          return {};
        }
      }
      case 'string': {
        return card.find('.string-input, .variable-content-input').val();
      }
      default:
        return null;
    }
  }

  /**
   * 获取变量卡片名称
   * @param card 卡片元素
   * @returns 卡片中的变量名称
   */
  public getVariableCardName(card: JQuery<HTMLElement>): string {
    return card.find('.variable-title').val() as string;
  }

  /**
   * 显示添加变量选择对话框
   * @param callback 选择后的回调函数
   */
  public async showAddVariableDialog(callback: (dataType: VariableDataType, floorId?: number) => void): Promise<void> {
    const currentType = this.getActiveVariableType();

    // 处理消息类型变量
    if (currentType === 'message') {
      await this.showFloorInputDialog(async floorId => {
        if (floorId === null) return;

        // 确认楼层后，再显示变量类型选择
        await this.showVariableTypeDialog(dataType => {
          callback(dataType, floorId);
        }, floorId);
      });
      return;
    }

    // 处理其他类型变量
    await this.showVariableTypeDialog(dataType => {
      callback(dataType);
    });
  }

  /**
   * 显示楼层输入对话框
   * @param callback 输入完成后的回调函数
   */
  public async showFloorInputDialog(callback: (floorId: number | null) => void): Promise<void> {
    const content = $(`
      <div>
        <h3>输入楼层号码</h3>
        <div class="floor-input-dialog">
          <input type="number" id="floor-input" min="0" placeholder="请输入楼层号码" />
          <div id="floor-input-error" class="floor-filter-error" style="display: none">请输入有效的楼层号码</div>
        </div>
      </div>
    `);

    const $inputField = content.find('#floor-input');
    const $errorMsg = content.find('#floor-input-error');

    // 获取当前最新楼层作为默认值
    const lastMessageId = getLastMessageId();
    if (lastMessageId >= 0) {
      $inputField.val(lastMessageId);
    }

    const result = await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
      okButton: '确认',
      cancelButton: '取消',
    });

    if (!result) {
      callback(null);
      return;
    }

    const floorId = parseInt($inputField.val() as string, 10);
    if (isNaN(floorId) || floorId < 0) {
      $errorMsg.show();
      setTimeout(() => this.showFloorInputDialog(callback), 10);
      return;
    }

    callback(floorId);
  }

  /**
   * 显示变量类型选择对话框
   * @param callback 选择后的回调函数
   * @param floorId 楼层ID(仅用于message类型)
   */
  public async showVariableTypeDialog(callback: (dataType: VariableDataType) => void, floorId?: number): Promise<void> {
    const content = $(`
      <div>
        <h3>选择变量类型</h3>
        <div class="variable-type-options">
          <div data-type="string"><i class="fa-regular fa-font"></i> 字符串</div>
          <div data-type="number"><i class="fa-regular fa-hashtag"></i> 数字</div>
          <div data-type="boolean"><i class="fa-regular fa-toggle-on"></i> 布尔值</div>
          <div data-type="array"><i class="fa-regular fa-list"></i> 数组</div>
          <div data-type="object"><i class="fa-regular fa-code"></i> 对象</div>
        </div>
      </div>
    `);

    content.find('.variable-type-options div').on('click', function () {
      const dataType = $(this).attr('data-type') as VariableDataType;
      callback(dataType);

      $('.popup').find('.popup-button-close').trigger('click');
    });

    await callGenericPopup(content, POPUP_TYPE.DISPLAY);
  }

  /**
   * 显示确认对话框
   * @param message 确认信息
   * @param callback 确认后的回调
   */
  public async showConfirmDialog(message: string, callback: (confirmed: boolean) => void): Promise<void> {
    const result = await callGenericPopup(message, POPUP_TYPE.CONFIRM, '', {
      okButton: '确认',
      cancelButton: '取消',
    });

    callback(!!result);
  }

  /**
   * 渲染变量管理器浮窗
   * 创建可拖动、可调整大小的浮窗
   */
  public render(): void {
    this.unrender();

    this.dialog = $(`
      <div class="variable-manager-dialog">
        <div class="dialog-header">
          <div class="dialog-title">变量管理器</div>
          <div class="dialog-controls">
            <button class="dialog-toggle-btn" title="折叠/展开内容"><i class="fa-solid fa-chevron-up"></i></button>
            <button class="dialog-close-btn"><i class="fa-solid fa-times"></i></button>
          </div>
        </div>
        <div class="dialog-content"></div>
        <div class="dialog-resize-handle"></div>
      </div>
    `);

    this.dialog.find('.dialog-content').append(this.container);

    this.dialog.find('.dialog-close-btn').on('click', () => {
      this.unrender();
    });

    this.dialog.find('.dialog-toggle-btn').on('click', () => {
      const $content = this.dialog!.find('.dialog-content');
      const $toggleBtn = this.dialog!.find('.dialog-toggle-btn i');

      $content.slideToggle(300, () => {
        if ($content.is(':visible')) {
          $toggleBtn.removeClass('fa-chevron-down').addClass('fa-chevron-up');
          this.dialog!.find('.dialog-resize-handle').show();
        } else {
          $toggleBtn.removeClass('fa-chevron-up').addClass('fa-chevron-down');
          this.dialog!.find('.dialog-resize-handle').hide();
        }
      });

      this.dialog!.toggleClass('content-collapsed');
    });

    $('body').append(this.dialog);

    this.initDraggableDialog();
    this.centerDialog();
    this.container.show();
  }

  /**
   * 关闭并清理变量管理器浮窗
   */
  public unrender(): void {
    if (this.dialog) {
      this.container.detach();
      this.dialog.remove();
      this.dialog = null;

      if (this.controller) {
        this.controller.cleanup();
      }
    }
  }

  /**
   * 初始化浮窗的拖动和调整大小功能
   */
  private initDraggableDialog(): void {
    if (!this.dialog) return;

    const isMobileDevice = isMobile();

    (this.dialog as any).draggable({
      handle: '.dialog-header',
      containment: 'window',
      start: () => {
        this.dialog?.addClass('dragging');
      },
      stop: () => {
        this.dialog?.removeClass('dragging');
      },
    });

    (this.dialog as any).resizable({
      // 桌面设备用所有边缘，移动设备仅用右下角
      handles: isMobileDevice ? 'se' : 'n,e,s,w,ne,se,sw,nw',
      minHeight: VariableView.MIN_DIALOG_HEIGHT,
      minWidth: VariableView.MIN_DIALOG_WIDTH,
      start: () => {
        this.dialog?.addClass('resizing');
      },
      stop: () => {
        this.dialog?.removeClass('resizing');
      },
    });

    // 控制调整大小控件的显示
    this.dialog.find('.dialog-resize-handle').toggle(isMobileDevice);
  }

  /**
   * 将浮窗居中显示
   */
  private centerDialog(): void {
    if (!this.dialog) return;

    const windowWidth = $(window).width() || 0;
    const windowHeight = $(window).height() || 0;

    const dialogWidth = this.dialog.outerWidth() || VariableView.MIN_DIALOG_WIDTH;
    const dialogHeight = this.dialog.outerHeight() || VariableView.MIN_DIALOG_HEIGHT;

    const left = Math.max(0, (windowWidth - dialogWidth) / 2);
    const top = Math.max(0, (windowHeight - dialogHeight) / 2);

    this.dialog.css({
      left: `${left}px`,
      top: `${top}px`,
      position: 'fixed',
    });
  }

  /**
   * 设置是否跳过动画效果
   * 实现 IDomUpdater 接口的方法
   * @param isSkipAnimation 是否跳过动画
   */
  public updateWithoutAnimation(isSkipAnimation: boolean): void {
    this._skipAnimation = isSkipAnimation;
  }

  public addVariableCard(name: string, value: any): void {
    try {
      const newCard = this.createAndAppendCard(name, value);

      if (!this._skipAnimation) {
        this.addAnimation(newCard, 'variable-added', () => {});
      }
    } catch (error) {
      console.error(`[VariableManager] 添加卡片"${name}"失败:`, error);
    }
  }

  public removeVariableCard(name: string): void {
    try {
      const $card = this.container.find(`.variable-card[data-name="${name}"]`);

      if ($card.length > 0) {
        // 检查变量卡片是否在楼层面板内
        const $floorPanel = $card.closest('.floor-panel');

        if (this._skipAnimation) {
          $card.remove();

          // 如果是楼层面板内的最后一个变量卡片，移除整个面板
          if ($floorPanel.length > 0) {
            const $remainingCards = $floorPanel.find('.variable-card');
            if ($remainingCards.length === 0) {
              $floorPanel.remove();
            }
          }
        } else {
          const callback = () => {
            $card.remove();

            if ($floorPanel.length > 0) {
              const $remainingCards = $floorPanel.find('.variable-card');
              if ($remainingCards.length === 0) {
                $floorPanel.remove();
              }
            }
          };
          this.addAnimation($card, 'variable-deleted', callback);
        }

        // 检查变量列表是否为空，显示空状态
        const activeContent = this.container.find('.tab-content.active');
        const $variableList = this.getOrCreateVariableList(activeContent);

        setTimeout(
          () => {
            if (
              $variableList.find('.variable-card').length === 0 &&
              $variableList.find('.floor-panel').length === 0 &&
              $variableList.find('.empty-state').length === 0
            ) {
              $variableList.html('<div class="empty-state"><p>暂无变量</p></div>');
            }
          },
          this._skipAnimation ? 0 : 300,
        ); // 等待动画完成
      } else {
        console.warn(`[VariableView (IDomUpdater)] 未找到要移除的卡片: ${name}`);
      }
    } catch (error) {
      console.error(`[VariableView (IDomUpdater)] 移除卡片"${name}"失败:`, error);
      const $card = this.container.find(`.variable-card[data-name="${name}"]`);
      if ($card.length > 0) {
        $card.remove();
      }
    }
  }

  /**
   * 显示键名输入对话框
   * @param callback 输入完成后的回调函数
   */
  public async showKeyNameInputDialog(callback: (keyName: string | null) => void): Promise<void> {
    const content = $(`
      <div>
        <h3>输入键名</h3>
        <div class="key-input-dialog">
          <input type="text" id="key-input" placeholder="请输入键名" />
          <div id="key-input-error" class="input-error" style="display: none">请输入有效的键名</div>
        </div>
      </div>
    `);

    const $inputField = content.find('#key-input');
    const $errorMsg = content.find('#key-input-error');

    const result = await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
      okButton: '确认',
      cancelButton: '取消',
    });

    if (!result) {
      callback(null);
      return;
    }

    const keyName = $inputField.val() as string;
    if (!keyName || keyName.trim() === '') {
      $errorMsg.show();
      setTimeout(() => this.showKeyNameInputDialog(callback), 10);
      return;
    }

    callback(keyName.trim());
  }

  /**
   * 添加动画效果
   * @param element 要添加动画效果的元素
   * @param animationClass CSS动画类名
   * @param callback 动画结束后的回调
   */
  public addAnimation(element: JQuery<HTMLElement>, animationClass: string, callback: () => void): void {
    // 生成唯一的事件命名空间
    const namespace = `animation.${animationClass}`;

    // 添加动画类
    element.addClass(animationClass);

    // 强制回流以确保动画立即应用
    void element[0].offsetHeight;

    // 使用requestAnimationFrame确保动画平滑
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {});
    });

    // 移除先前可能存在的相同事件监听器
    element.off(`animationend.${namespace}`);

    // 添加新的动画结束监听器
    element.on(`animationend.${namespace}`, function () {
      // 清理事件监听器
      $(this).off(`animationend.${namespace}`);
      // 移除动画类
      $(this).removeClass(animationClass);
      // 执行回调
      callback();
    });
  }
}