import { UserOutlined, LockOutlined, IdcardOutlined } from '@ant-design/icons'
import { message, Form, Button, Input } from 'antd'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import Logo from '@/assets/images/logo.svg'
import I18n from '@/components/I18n'
import { register } from '@/servers/login'
import { PASSWORD_RULE } from '@/utils/config'
import { encryptMd5 } from '@/utils/crypto'

import type { RegisterData } from '@/pages/login/model'
import type { FormProps } from 'antd'

// 注册表单值（含确认密码）
type RegisterFormValues = RegisterData & { confirmPassword?: string }

const Register = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [isLoading, setLoading] = useState(false)

  /**
   * 处理注册
   * @param values - 表单数据
   */
  const handleFinish: FormProps['onFinish'] = async (values: RegisterFormValues) => {
    if (values.password !== values.confirmPassword) {
      return message.warning({
        content: t('login.confirmPasswordMessage'),
        key: 'confirmPassword',
      })
    }
    try {
      setLoading(true)
      const { code } = await register({
        username: values.username,
        password: encryptMd5(values.password),
        real_name: values.real_name,
      })
      if (Number(code) !== 200) {
        return
      }
      message.success({ content: t('login.registerSuccess'), key: 'register' })
      navigate('/login')
    } finally {
      setLoading(false)
    }
  }

  const handleFinishFailed: FormProps['onFinishFailed'] = (errors) => {
    console.error('错误信息:', errors)
  }

  return (
    <div className='w-screen h-screen relative bg-light-400'>
      <div className='absolute top-5 right-5'>
        <I18n />
      </div>
      <div
        className='
          w-340px
          p-30px
          rounded-5px
          bg-white
          box-border
          absolute
          left-1/2
          top-1/2
          -translate-x-1/2
          -translate-y-1/2
        '
      >
        <div className='pb-30px pt-10px flex items-center justify-center'>
          <img className='mr-2 object-contain' width='30' height='30' src={Logo} alt='LOGO' />
          <span className='text-xl font-bold tracking-2px'>{t('login.systemRegister')}</span>
        </div>
        <Form name='horizontal_register' layout='vertical' autoComplete='on' onFinish={handleFinish} onFinishFailed={handleFinishFailed}>
          <Form.Item
            label={t('login.username')}
            name='username'
            rules={[{ required: true, message: t('public.pleaseEnter', { name: t('login.username') }) }]}
          >
            <Input placeholder={t('login.pleaseEnterUsername')} autoComplete='username' addonBefore={<UserOutlined className='change' />} />
          </Form.Item>

          <Form.Item label={t('public.name')} name='real_name'>
            <Input placeholder={t('system.pleaseEnterRealName')} addonBefore={<IdcardOutlined className='change' />} />
          </Form.Item>

          <Form.Item
            label={t('login.password')}
            name='password'
            rules={[{ required: true, message: t('public.pleaseEnter', { name: t('login.password') }) }, PASSWORD_RULE(t)]}
          >
            <Input.Password
              placeholder={t('login.pleaseEnterPassword')}
              autoComplete='new-password'
              addonBefore={<LockOutlined className='change' />}
            />
          </Form.Item>

          <Form.Item
            label={t('login.confirmPassword')}
            name='confirmPassword'
            rules={[
              {
                required: true,
                message: t('public.pleaseEnter', { name: t('login.confirmPassword') }),
              },
              PASSWORD_RULE(t),
            ]}
          >
            <Input.Password placeholder={t('login.confirmPassword')} autoComplete='new-password' addonBefore={<LockOutlined className='change' />} />
          </Form.Item>

          <Form.Item>
            <Button type='primary' htmlType='submit' className='w-full mt-5px rounded-5px tracking-2px' loading={isLoading}>
              {t('login.register')}
            </Button>
          </Form.Item>

          <div className='flex justify-center'>
            <Button type='link' size='small' onClick={() => navigate('/login')}>
              {t('login.backToLogin')}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  )
}

export default Register
