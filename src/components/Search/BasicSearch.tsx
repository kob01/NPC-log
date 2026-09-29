import { SearchOutlined, PlusOutlined, ClearOutlined } from '@ant-design/icons'
import { Button, Form } from 'antd'
import { type LegacyRef, forwardRef } from 'react'
import { useTranslation } from 'react-i18next'

import { filterDayjs } from '../Dates/utils/helper'
import { getComponent } from '../Form/utils/componentMap'
import { handleValuePropName } from '../Form/utils/helper'

import type { FormData, FormList } from '#/form'
import type { ColProps, FormInstance, FormProps } from 'antd'
import type { ReactNode } from 'react'

interface Props extends FormProps {
  list: FormList[]
  data: FormData
  isLoading?: boolean
  isSearch?: boolean
  isClear?: boolean
  isCreate?: boolean
  children?: ReactNode
  labelCol?: Partial<ColProps>
  wrapperCol?: Partial<ColProps>
  onCreate?: () => void
  handleFinish: FormProps['onFinish']
}

const BasicSearch = forwardRef((props: Props, ref: LegacyRef<FormInstance>) => {
  const {
    list,
    data,
    isLoading,
    isSearch = true,
    isClear = true,
    isCreate = true,
    children,
    labelCol,
    wrapperCol,
    handleFinish,
  } = props
  const { t } = useTranslation()
  const [form] = Form.useForm()

  // 清除多余参数
  const formProps = { ...props }
  delete formProps.isSearch
  delete formProps.isClear
  delete formProps.isCreate
  delete formProps.isLoading
  delete formProps.onCreate
  delete formProps.handleFinish

  /** 回车处理 */
  const onPressEnter = () => {
    form?.submit()
  }

  /** 点击新增 */
  const onCreate = () => {
    props.onCreate?.()
  }

  /** 点击清除 */
  const onClear = () => {
    // resetFields 只会回到 initialValues（也就是上一次已提交的 data），
    // 再 setFieldsValue(data) 更是把条件原封不动写回去，导致「清除」什么也没清。
    // 这里按搜索项列表逐个置空，再提交一次以拉取全部数据。
    const emptyValues = (list || []).reduce((acc: FormData, item) => {
      if (Array.isArray(item.name)) {
        item.name.forEach((key) => {
          acc[key] = undefined
        })
      } else {
        acc[item.name] = undefined
      }
      return acc
    }, {})
    form?.setFieldsValue(emptyValues)
    form?.submit()
  }

  /**
   * 提交表单
   * @param values - 表单值
   */
  const onFinish: FormProps['onFinish'] = (values) => {
    if (handleFinish) {
      // 将dayjs类型转为字符串
      const params = filterDayjs(values, list)
      handleFinish?.(params)
    }
  }

  /**
   * 表单提交失败处理
   * @param errorInfo - 错误信息
   */
  const onFinishFailed: FormProps['onFinishFailed'] = (errorInfo) => {
    console.warn('搜索错误:', errorInfo)
  }

  return (
    <div id='searches' className='py-3'>
      <Form
        layout='inline'
        {...formProps}
        ref={ref}
        form={form}
        labelCol={labelCol ? labelCol : { span: 8 }}
        wrapperCol={wrapperCol ? wrapperCol : { span: 16 }}
        initialValues={data}
        onFinish={onFinish}
        onFinishFailed={onFinishFailed}
        autoComplete='off'
      >
        {list?.map((item) => (
          <Form.Item
            key={`${item.name}`}
            label={item.label}
            name={item.name}
            className='!mb-5px'
            labelCol={{ style: { width: item.labelCol } }}
            wrapperCol={{ style: { width: item.wrapperCol } }}
            rules={item.rules}
            valuePropName={handleValuePropName(item.component)}
          >
            {getComponent(t, item, onPressEnter)}
          </Form.Item>
        ))}

        <div className='flex items-center flex-wrap'>
          {!!isSearch && (
            <Form.Item>
              <Button
                type='primary'
                htmlType='submit'
                className='!mb-5px'
                loading={isLoading}
                icon={<SearchOutlined />}
              >
                {t('public.search')}
              </Button>
            </Form.Item>
          )}

          {!!isClear && (
            <Form.Item>
              <Button className='!mb-5px' icon={<ClearOutlined />} onClick={onClear}>
                {t('public.clear')}
              </Button>
            </Form.Item>
          )}

          {!!isCreate && (
            <Form.Item>
              <Button type='primary' className='!mb-5px' icon={<PlusOutlined />} onClick={onCreate}>
                {t('public.create')}
              </Button>
            </Form.Item>
          )}

          {children}
        </div>
      </Form>
    </div>
  )
})

export default BasicSearch
