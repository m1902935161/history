import { VariableDataType } from '@/component/variable_manager/types';
import { getSortableDelay } from '@sillytavern/scripts/utils';

export class VariableCardFactory {
  /**
   * 从值推断变量数据类型
   * @param value 要推断类型的值
   * @returns 推断出的变量数据类型
   */
  public inferDataType(value: any): VariableDataType {
    if (Array.isArray(value)) {
      return 'array';
    } else if (typeof value === 'boolean') {
      return 'boolean';
    } else if (typeof value === 'number') {
      return 'number';
    } else if (typeof value === 'object' && value !== null) {
      return 'object';
    }
    return 'string';
  }

  /**
   * 设置变量卡片的数据属性
   * @param card 变量卡片jQuery对象
   * @param name 变量名称
   * @param value 变量值
   * @returns 设置了属性的变量卡片jQuery对象
   */
  public setCardDataAttributes(card: JQuery<HTMLElement>, name: string, value: any): JQuery<HTMLElement> {
    card.attr('data-name', name);
    card.attr('data-original-name', name);
    card.attr('data-value', JSON.stringify(value));
    return card;
  }

  /**
   * 创建变量卡片
   * @param type 变量数据类型
   * @param name 变量名称
   * @param value 变量值
   * @param showTypeDialogCallback 显示类型选择对话框的回调函数（仅用于对象类型）
   * @returns 变量卡片jQuery对象
   */
  public createCard(
    type: VariableDataType,
    name: string,
    value: any,
    showTypeDialogCallback?: (callback: (dataType: VariableDataType) => void) => Promise<void>,
  ): JQuery<HTMLElement> {
    let card: JQuery<HTMLElement>;
    switch (type) {
      case 'array':
        card = this.createArrayCard(name, value as any[]);
        break;
      case 'boolean':
        card = this.createBooleanCard(name, value as boolean);
        break;
      case 'number':
        card = this.createNumberCard(name, value as number);
        break;
      case 'object':
        card = this.createObjectCard(name, value as object, showTypeDialogCallback);
        break;
      case 'string':
        card = this.createStringCard(name, String(value));
        break;
      default:
        // 默认返回字符串变量卡片（包括处理null和undefined值）
        card = this.createStringCard(name, String(value));
    }

    // 设置数据属性
    return this.setCardDataAttributes(card, name, value);
  }

  /**
   * 创建数组变量卡片
   * @param name 变量名称
   * @param items 数组项
   * @returns 数组变量卡片jQuery对象
   */
  private createArrayCard(name: string, items: any[]): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="array" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-list"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="变量名称">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="保存">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="删除">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <div class="list-items-container">
            ${this.generateArrayItems(items)}
          </div>
          <button class="add-list-item"><i class="fa-solid fa-plus"></i> 添加项目</button>
        </div>
      </div>
    `);

    // 为列表添加拖拽功能
    const listContainer = card.find('.list-items-container');
    listContainer.sortable({
      delay: getSortableDelay(),
      handle: '.drag-handle',
      // 此处只记录排序事件，实际保存由保存按钮触发
    });

    return card;
  }

  /**
   * 生成数组项HTML
   * @param items 数组项
   * @returns 数组项HTML字符串
   */
  private generateArrayItems(items: any[]): string {
    if (!items || items.length === 0) {
      return '';
    }

    return items
      .map(item => {
        // 检查是否为对象类型，如果是则使用JSON.stringify进行格式化
        let displayValue: string;
        if (item !== null && typeof item === 'object') {
          displayValue = JSON.stringify(item, null, 2);
        } else {
          displayValue = String(item);
        }

        return `
      <div class="list-item">
        <span class="drag-handle">☰</span>
        <textarea class="variable-content-input">${displayValue}</textarea>
        <button class="list-item-delete"><i class="fa-solid fa-times"></i></button>
      </div>
    `;
      })
      .join('');
  }

  /**
   * 创建布尔变量卡片
   * @param name 变量名称
   * @param value 布尔值
   * @returns 布尔变量卡片jQuery对象
   */
  private createBooleanCard(name: string, value: boolean): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="boolean" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-regular fa-toggle-on"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="变量名称">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="保存">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="删除">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <div class="boolean-input-container">
            <div class="boolean-buttons-container">
              <button class="boolean-btn ${value ? 'active' : ''}" data-value="true">True</button>
              <button class="boolean-btn ${!value ? 'active' : ''}" data-value="false">False</button>
            </div>
          </div>
        </div>
      </div>
    `);

    card.find('.boolean-btn').on('click', function () {
      card.find('.boolean-btn').removeClass('active');
      $(this).addClass('active');
    });

    return card;
  }

  /**
   * 创建数字变量卡片
   * @param name 变量名称
   * @param value 数字值
   * @returns 数字变量卡片jQuery对象
   */
  private createNumberCard(name: string, value: number): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="number" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-hashtag"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="变量名称">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="保存">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="删除">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <input type="number" class="number-input variable-content-input" value="${value}" step="any">
        </div>
      </div>
    `);

    return card;
  }

  /**
   * 创建对象变量卡片
   * @param name 变量名称
   * @param value 对象值
   * @param showTypeDialogCallback 显示类型选择对话框的回调函数
   * @returns 对象变量卡片jQuery对象
   */
  private createObjectCard(
    name: string,
    value: object,
    showTypeDialogCallback?: (callback: (dataType: VariableDataType) => void) => Promise<void>,
  ): JQuery<HTMLElement> {
    const jsonString = JSON.stringify(value, null, 2);

    const card = $(`
      <div class="variable-card" data-type="object" data-name="${name}" data-view-mode="card">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-regular fa-code"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="变量名称">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn toggle-view-btn" title="切换到JSON视图">
              <i class="fa-regular fa-list"></i>
            </button>
            <button class="variable-action-btn add-key-btn" title="添加键值对">
              <i class="fa-regular fa-plus"></i>
            </button>
            <button class="variable-action-btn save-btn" title="保存">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="删除">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <textarea class="json-input variable-content-input" placeholder="输入JSON对象" style="display: none;">${jsonString}</textarea>
          <div class="object-card-view">
            <div class="nested-cards-container"></div>
          </div>
        </div>
      </div>
    `);

    // 监听JSON输入框变更，更新卡片视图
    card.find('.json-input').on('change', () => {
      try {
        const jsonValue = JSON.parse(card.find('.json-input').val() as string);

        // 如果当前是卡片视图模式，需要更新卡片视图
        if (card.attr('data-view-mode') === 'card') {
          this.renderObjectCardView(card, jsonValue);
        }

        // 更新数据属性
        card.attr('data-value', JSON.stringify(jsonValue));
      } catch (e) {
        console.error('JSON解析错误:', e);
      }
    });

    // 添加切换视图按钮事件
    card.find('.toggle-view-btn').on('click', () => {
      const $card = card;
      const currentMode = $card.attr('data-view-mode') || 'json';

      // 切换模式
      const newMode = currentMode === 'json' ? 'card' : 'json';
      $card.attr('data-view-mode', newMode);

      // 从卡片的data-value属性获取最新数据
      let latestData;
      try {
        latestData = JSON.parse($card.attr('data-value') || '{}');
      } catch (e) {
        console.error('获取最新数据失败:', e);
        latestData = {};
      }

      // 更新按钮图标
      const $icon = $card.find('.toggle-view-btn i');
      if (newMode === 'json') {
        $icon.removeClass('fa-list').addClass('fa-eye');
        $card.find('.toggle-view-btn').attr('title', '切换到卡片视图');

        // 显示JSON输入框，隐藏卡片视图
        $card.find('.json-input').show();
        $card.find('.object-card-view').hide();

        // 更新JSON输入框内容为最新数据
        $card.find('.json-input').val(JSON.stringify(latestData, null, 2));
      } else {
        $icon.removeClass('fa-eye').addClass('fa-list');
        $card.find('.toggle-view-btn').attr('title', '切换到JSON视图');

        // 隐藏JSON输入框，显示卡片视图
        $card.find('.json-input').hide();
        $card.find('.object-card-view').show();

        try {
          // 渲染卡片视图
          this.renderObjectCardView(card, latestData);
        } catch (e) {
          console.error('渲染卡片视图错误:', e);

          // 解析错误时回退到JSON视图
          $card.attr('data-view-mode', 'json');
          $card.find('.json-input').show();
          $card.find('.object-card-view').hide();
          $icon.removeClass('fa-list').addClass('fa-eye');
          $card.find('.toggle-view-btn').attr('title', '切换到卡片视图');
        }
      }
    });

    // 添加键值对按钮事件
    card.find('.add-key-btn').on('click', function () {
      if (showTypeDialogCallback) {
        // 使用回调函数显示类型选择对话框
        showTypeDialogCallback(async (dataType: VariableDataType) => {
          const $card = $(this).closest('.variable-card');
          $card.trigger('object:addKey', [dataType]);
        });
      } else {
        console.log('未提供类型选择对话框回调函数');
      }
    });

    // 在返回卡片之前渲染初始卡片视图
    try {
      const jsonValue = JSON.parse(jsonString);
      this.renderObjectCardView(card, jsonValue);
    } catch (e) {
      console.error('JSON解析错误:', e);
      // 解析错误时回退到JSON视图
      card.attr('data-view-mode', 'json');
      card.find('.json-input').show();
      card.find('.object-card-view').hide();
      card.find('.toggle-view-btn i').removeClass('fa-list').addClass('fa-eye');
      card.find('.toggle-view-btn').attr('title', '切换到卡片视图');
    }

    return card;
  }

  /**
   * 渲染对象卡片的卡片视图
   * @param card 对象卡片jQuery对象
   * @param value 对象值
   */
  private renderObjectCardView(card: JQuery<HTMLElement>, value: Record<string, any>): void {
    const $container = card.find('.nested-cards-container');
    $container.empty();

    // 遍历对象的所有键值对，为每个键值对创建卡片
    for (const key in value) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const propertyValue = value[key];
        const type = this.inferDataType(propertyValue);

        // 创建嵌套卡片的容器
        const $nestedCardWrapper = $(`
          <div class="nested-card-wrapper" data-key="${key}">
            <div class="nested-card-content"></div>
          </div>
        `);

        // 创建对应类型的卡片
        const nestedCard = this.createCard(type, key, propertyValue);

        // 简化嵌套卡片的外观
        const titleInput = nestedCard.find('.variable-title-container input');
        titleInput.attr('title', '点击编辑键名');
        titleInput.addClass('nested-card-key-input');

        // 把嵌套卡片中的save-btn和delete-btn分别改为object-save-btn和object-delete-btn
        nestedCard.find('.variable-action-btn.save-btn').removeClass('save-btn').addClass('object-save-btn');
        nestedCard.find('.variable-action-btn.delete-btn').removeClass('delete-btn').addClass('object-delete-btn');

        // 移除直接绑定的事件，让事件可以冒泡到控制器
        // 将以前需要的数据作为属性添加到按钮元素上，以便控制器可以读取
        const objectDeleteBtn = nestedCard.find('.variable-action-btn.object-delete-btn');
        objectDeleteBtn.attr('data-nested-key', $nestedCardWrapper.attr('data-key') || '');
        objectDeleteBtn.attr('data-parent-card-id', card.attr('id') || '');

        // 将卡片添加到容器中
        $nestedCardWrapper.find('.nested-card-content').append(nestedCard);
        $container.append($nestedCardWrapper);

        // 添加键名点击编辑功能
        titleInput.on('input', function () {
          const $input = $(this);
          const oldKey = $nestedCardWrapper.attr('data-key') || '';
          const newKey = $input.val() as string;

          if (newKey && newKey !== oldKey && oldKey) {
            // 更新键名
            $nestedCardWrapper.attr('data-key', newKey);

            // 获取对象值并更新键名
            const objValue = JSON.parse(card.attr('data-value') || '{}') as Record<string, any>;
            if (objValue[oldKey] !== undefined) {
              objValue[newKey] = objValue[oldKey];
              delete objValue[oldKey];

              // 更新对象卡片的值
              const jsonString = JSON.stringify(objValue, null, 2);
              card.find('.json-input').val(jsonString);
              card.attr('data-value', JSON.stringify(objValue));
            }
          }
        });

        // 添加保存按钮点击事件 - 使用一个特殊的事件名称避免级联触发
        nestedCard.find('.variable-action-btn.object-save-btn').on('click', () => {
          // 获取当前嵌套卡片的键和值
          const currentKey = $nestedCardWrapper.attr('data-key') || '';

          // 根据卡片类型获取最新值
          let nestedValue;
          const nestedCardType = nestedCard.attr('data-type');

          switch (nestedCardType) {
            case 'string':
              nestedValue = nestedCard.find('.string-input').val();
              break;
            case 'number':
              nestedValue = parseFloat(nestedCard.find('.number-input').val() as string);
              break;
            case 'boolean':
              nestedValue = nestedCard.find('.boolean-btn.active').attr('data-value') === 'true';
              break;
            case 'array':
              nestedValue = [];
              nestedCard.find('.list-item .variable-content-input').each(function () {
                let elementValue = $(this).val() as string;

                // 尝试解析可能的JSON字符串
                if (typeof elementValue === 'string') {
                  elementValue = elementValue.trim();
                  // 检查是否为可能的对象或数组格式
                  if (
                    (elementValue.startsWith('{') && elementValue.endsWith('}')) ||
                    (elementValue.startsWith('[') && elementValue.endsWith(']'))
                  ) {
                    try {
                      // 尝试解析JSON字符串
                      const parsedValue = JSON.parse(elementValue);
                      nestedValue.push(parsedValue);
                      return; // 提前返回，避免重复添加
                    } catch (error) {
                      console.log('JSON字符串解析失败，保留原始字符串:', elementValue);
                    }
                  }
                }

                // 如果不是JSON或解析失败，保留原始值
                nestedValue.push(elementValue);
              });
              break;
            case 'object':
              nestedValue = JSON.parse(nestedCard.attr('data-value') || '{}');
              break;
            default:
              nestedValue = nestedCard.find('.variable-content-input').val();
          }

          // 更新父对象中对应键的值
          const parentObjValue = JSON.parse(card.attr('data-value') || '{}') as Record<string, any>;
          parentObjValue[currentKey] = nestedValue;

          // 更新父对象卡片的值
          const updatedJsonString = JSON.stringify(parentObjValue, null, 2);
          card.find('.json-input').val(updatedJsonString);
          card.attr('data-value', JSON.stringify(parentObjValue));

          // 更新嵌套卡片的值属性
          nestedCard.attr('data-value', JSON.stringify(nestedValue));

          card.trigger('save:fromNestedCard');

          if (!card.data('saving')) {
            card.data('saving', true);
            try {
              const topCard = card.closest('.variable-card');
              topCard.find('> .variable-card-header .object-save-btn').trigger('click');
            } finally {
              setTimeout(() => {
                card.data('saving', false);
              }, 100);
            }
          }
        });
      }
    }
  }

  /**
   * 创建字符串变量卡片
   * @param name 变量名称
   * @param value 字符串值
   * @returns 字符串变量卡片jQuery对象
   */
  private createStringCard(name: string, value: string): JQuery<HTMLElement> {
    const card = $(`
      <div class="variable-card" data-type="string" data-name="${name}">
        <div class="variable-card-header">
          <div class="variable-title-container">
            <i class="fa-solid fa-font"></i>
            <input type="text" class="variable-title" value="${name}" placeholder="变量名称">
          </div>
          <div class="variable-actions">
            <button class="variable-action-btn save-btn" title="保存">
              <i class="fa-regular fa-save"></i>
            </button>
            <button class="variable-action-btn delete-btn" title="删除">
              <i class="fa-regular fa-trash-can"></i>
            </button>
          </div>
        </div>
        <div class="variable-card-content">
          <textarea class="string-input variable-content-input" placeholder="输入字符串值">${value}</textarea>
        </div>
      </div>
    `);

    return card;
  }
}
