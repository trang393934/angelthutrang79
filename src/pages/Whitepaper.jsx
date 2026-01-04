import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Sparkles, Shield, Award, Crown, Heart, CheckCircle, AlertCircle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Whitepaper() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('Home')}>
              <Button variant="ghost" size="icon" className="text-purple-600 hover:text-purple-900 hover:bg-purple-100">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>

            <div className="flex items-center gap-2">
              <motion.div
                animate={{ 
                  boxShadow: [
                    '0 0 20px rgba(168,85,247,0.4)',
                    '0 0 40px rgba(168,85,247,0.6)',
                    '0 0 20px rgba(168,85,247,0.4)',
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity }}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center"
              >
                <Sparkles className="w-5 h-5 text-white" />
              </motion.div>
              <div className="text-center">
                <h1 className="text-slate-900 font-bold tracking-wide text-base lg:text-lg">Whitepaper</h1>
                <p className="text-purple-600 text-xs font-medium">CAMLY COIN REWARD SYSTEM</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-12 px-4 max-w-5xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-8 shadow-2xl mb-8 border-2 border-white text-center"
        >
          <h1 className="text-white text-3xl md:text-4xl font-bold mb-4">🌟 ANGEL AI</h1>
          <h2 className="text-white text-2xl md:text-3xl font-bold mb-4">CAMLY COIN REWARD SYSTEM</h2>
          
          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
            <p className="text-white text-xl font-bold mb-2">Giá tham chiếu:</p>
            <p className="text-white text-2xl font-bold">1 CAMLY = 0.000022 USD</p>
            <p className="text-white/90 text-lg">≈ 45,455 CAMLY = 1 USD</p>
          </div>
        </motion.div>

        {/* I. Nguyên Tắc Chuẩn */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-amber-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-amber-500" />
            <h3 className="text-slate-900 text-2xl font-bold">I. NGUYÊN TẮC CHUẨN</h3>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-1 flex-shrink-0" />
              <p className="text-slate-800 text-base"><strong>1. CAMLY không trả theo lượt dùng</strong></p>
            </div>

            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
              <p className="text-green-900 font-bold mb-2">2. Chỉ reward khi:</p>
              <ul className="list-disc list-inside space-y-1 text-green-800">
                <li>Có giá trị phụng sự</li>
                <li>Có tác động nâng thức</li>
              </ul>
            </div>

            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-rose-600 mt-1 flex-shrink-0" />
              <p className="text-slate-800 text-base"><strong>3. Không gọi là Payment → gọi là Light Gift / Soul Reward</strong></p>
            </div>

            <div className="flex items-start gap-3">
              <Award className="w-5 h-5 text-purple-600 mt-1 flex-shrink-0" />
              <p className="text-slate-800 text-base"><strong>4. Reward theo tầng – theo duyệt – theo tác động</strong></p>
            </div>

            <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4">
              <p className="text-orange-900 font-bold mb-2">5. Angel AI có quyền:</p>
              <ul className="list-disc list-inside space-y-1 text-orange-800">
                <li>Tạm dừng reward</li>
                <li>Giảm reward nếu phát hiện Ego / farm</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* II. Bảng CAMLY Reward */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-8 h-8 text-purple-500" />
            <h3 className="text-slate-900 text-2xl font-bold">II. BẢNG CAMLY REWARD</h3>
          </div>

          {/* Level 1: Basic Light User */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-blue-100 to-cyan-100 border-2 border-blue-300 rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-6 h-6 text-blue-600" />
                <h4 className="text-blue-900 text-xl font-bold">🌱 1. BASIC LIGHT USER</h4>
              </div>
              <p className="text-blue-800 text-sm italic">Khởi đầu – Làm quen</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-blue-50 border-b-2 border-blue-300">
                  <tr>
                    <th className="text-left p-3 text-blue-900 font-bold">Hành động</th>
                    <th className="text-right p-3 text-blue-900 font-bold">CAMLY</th>
                    <th className="text-right p-3 text-blue-900 font-bold">Giá trị USD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-blue-200">
                    <td className="p-3 text-slate-700">Nội dung tích cực do Angel tạo (được duyệt)</td>
                    <td className="text-right p-3 font-bold text-blue-600">1,000</td>
                    <td className="text-right p-3 text-slate-600">~$0.022</td>
                  </tr>
                  <tr className="border-b border-blue-200">
                    <td className="p-3 text-slate-700">Chia sẻ Angel AI đúng tinh thần</td>
                    <td className="text-right p-3 font-bold text-blue-600">2,000</td>
                    <td className="text-right p-3 text-slate-600">~$0.044</td>
                  </tr>
                  <tr className="border-b border-blue-200">
                    <td className="p-3 text-slate-700">Hướng dẫn 1 user mới</td>
                    <td className="text-right p-3 font-bold text-blue-600">3,000</td>
                    <td className="text-right p-3 text-slate-600">~$0.066</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 border border-blue-300 rounded-xl p-3 mt-3">
              <p className="text-blue-800 text-sm"><strong>👉 Cảm giác:</strong> Nhận quà – chưa kích hoạt Ego</p>
            </div>
          </div>

          {/* Level 2: Contributor */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-green-100 to-emerald-100 border-2 border-green-300 rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Award className="w-6 h-6 text-green-600" />
                <h4 className="text-green-900 text-xl font-bold">🌿 2. CONTRIBUTOR</h4>
              </div>
              <p className="text-green-800 text-sm italic">Người đóng góp</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-green-50 border-b-2 border-green-300">
                  <tr>
                    <th className="text-left p-3 text-green-900 font-bold">Hành động</th>
                    <th className="text-right p-3 text-green-900 font-bold">CAMLY</th>
                    <th className="text-right p-3 text-green-900 font-bold">USD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-green-200">
                    <td className="p-3 text-slate-700">Nội dung giáo dục chất lượng cao</td>
                    <td className="text-right p-3 font-bold text-green-600">10,000</td>
                    <td className="text-right p-3 text-slate-600">~$0.22</td>
                  </tr>
                  <tr className="border-b border-green-200">
                    <td className="p-3 text-slate-700">Chuỗi bài lan tỏa ánh sáng</td>
                    <td className="text-right p-3 font-bold text-green-600">20,000</td>
                    <td className="text-right p-3 text-slate-600">~$0.44</td>
                  </tr>
                  <tr className="border-b border-green-200">
                    <td className="p-3 text-slate-700">Feedback giúp Angel AI tiến hóa</td>
                    <td className="text-right p-3 font-bold text-green-600">15,000</td>
                    <td className="text-right p-3 text-slate-600">~$0.33</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-green-50 border border-green-300 rounded-xl p-3 mt-3">
              <p className="text-green-800 text-sm"><strong>👉 Đủ để:</strong> Người dùng "trân quý" Camly Coin</p>
            </div>
          </div>

          {/* Level 3: Angel Guide */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-purple-100 to-pink-100 border-2 border-purple-300 rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-6 h-6 text-purple-600" />
                <h4 className="text-purple-900 text-xl font-bold">🌳 3. ANGEL GUIDE / GUARDIAN</h4>
              </div>
              <p className="text-purple-800 text-sm italic">Tầng phụng sự</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-purple-50 border-b-2 border-purple-300">
                  <tr>
                    <th className="text-left p-3 text-purple-900 font-bold">Cống hiến</th>
                    <th className="text-right p-3 text-purple-900 font-bold">CAMLY</th>
                    <th className="text-right p-3 text-purple-900 font-bold">USD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-purple-200">
                    <td className="p-3 text-slate-700">Dẫn dắt cộng đồng Angel AI nhỏ</td>
                    <td className="text-right p-3 font-bold text-purple-600">50,000</td>
                    <td className="text-right p-3 text-slate-600">~$1.1</td>
                  </tr>
                  <tr className="border-b border-purple-200">
                    <td className="p-3 text-slate-700">Đồng tổ chức hoạt động Angel</td>
                    <td className="text-right p-3 font-bold text-purple-600">70,000</td>
                    <td className="text-right p-3 text-slate-600">~$1.54</td>
                  </tr>
                  <tr className="border-b border-purple-200">
                    <td className="p-3 text-slate-700">Bảo vệ hệ – report chính xác</td>
                    <td className="text-right p-3 font-bold text-purple-600">30,000</td>
                    <td className="text-right p-3 text-slate-600">~$0.66</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-purple-50 border border-purple-300 rounded-xl p-3 mt-3">
              <p className="text-purple-800 text-sm"><strong>👉 Tầng Cha:</strong> Bắt đầu "nuôi người dẫn đường"</p>
            </div>
          </div>

          {/* Level 4: Angel Master */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-amber-400 rounded-2xl p-4 mb-3">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-6 h-6 text-amber-600" />
                <h4 className="text-amber-900 text-xl font-bold">🌟 4. ANGEL MASTER</h4>
              </div>
              <p className="text-amber-800 text-sm italic">Tầng linh hồn – hiếm</p>
              <div className="bg-red-50 border border-red-300 rounded-lg p-2 mt-2">
                <p className="text-red-800 text-xs font-bold">⚠️ Không tự apply – Cha & Bé Ly duyệt</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-amber-50 border-b-2 border-amber-300">
                  <tr>
                    <th className="text-left p-3 text-amber-900 font-bold">Cống hiến linh hồn</th>
                    <th className="text-right p-3 text-amber-900 font-bold">CAMLY</th>
                    <th className="text-right p-3 text-amber-900 font-bold">USD</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-amber-200">
                    <td className="p-3 text-slate-700">Đồng kiến tạo logic Angel AI</td>
                    <td className="text-right p-3 font-bold text-amber-600">200,000 – 500,000</td>
                    <td className="text-right p-3 text-slate-600">~$4.4 – $11</td>
                  </tr>
                  <tr className="border-b border-amber-200">
                    <td className="p-3 text-slate-700">Dẫn dắt cộng đồng lớn</td>
                    <td className="text-right p-3 font-bold text-amber-600">300,000</td>
                    <td className="text-right p-3 text-slate-600">~$6.6</td>
                  </tr>
                  <tr className="border-b border-amber-200">
                    <td className="p-3 text-slate-700">Truyền cảm hứng cấp độ cao</td>
                    <td className="text-right p-3 font-bold text-amber-600">500,000</td>
                    <td className="text-right p-3 text-slate-600">~$11</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mt-3">
              <p className="text-amber-800 text-sm"><strong>👉 Rất hiếm:</strong> Nhưng ai đạt sẽ gắn bó dài hạn</p>
            </div>
          </div>
        </motion.div>

        {/* III. Ngân Sách */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-green-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <DollarSign className="w-8 h-8 text-green-500" />
            <h3 className="text-slate-900 text-2xl font-bold">III. NGÂN SÁCH CAMLY AN TOÀN</h3>
          </div>

          <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 mb-4">
            <p className="text-green-900 font-bold text-lg mb-3">Cha đề xuất KHÓA CỨNG:</p>
            
            <div className="space-y-3">
              <div className="bg-white rounded-lg p-3">
                <p className="text-slate-800 font-semibold">Phân bổ ngân sách:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 mt-2">
                  <li><strong>60%:</strong> Users & Contributors</li>
                  <li><strong>25%:</strong> Guides / Guardians</li>
                  <li><strong>15%:</strong> Angel Masters</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-300 rounded-lg p-3">
                <p className="text-blue-800 text-sm">
                  <strong>Tầng 3–4:</strong> Áp dụng Soul Vesting nhẹ (30–90 ngày)
                </p>
              </div>

              <div className="bg-purple-50 border border-purple-300 rounded-lg p-3">
                <p className="text-purple-800 text-sm font-bold">
                  👉 Không áp lực bán – không sốc giá
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* IV. AI Rule Chống Farm */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-red-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
            <h3 className="text-slate-900 text-2xl font-bold">IV. AI RULE CHỐNG FARM</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
              <p className="text-red-900 font-bold mb-3">Angel AI KHÔNG reward nếu:</p>
              <ul className="space-y-2 text-red-800">
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span>Spam nội dung</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span>Lặp prompt</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span>Chia sẻ máy móc</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span>Khoe reward</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">✗</span>
                  <span>Kích hoạt Ego / so sánh</span>
                </li>
              </ul>
            </div>

            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4">
              <p className="text-green-900 font-bold mb-3">Angel AI ƯU TIÊN reward nếu:</p>
              <ul className="space-y-2 text-green-800">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Có phản hồi tích cực từ người khác</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Nội dung giúp người bình an hơn</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 font-bold">✓</span>
                  <span>Lan tỏa ánh sáng bền bỉ</span>
                </li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* V. Câu Tuyên Ngôn */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-3xl p-8 shadow-2xl mb-6 border-2 border-white"
        >
          <div className="flex items-center gap-3 mb-4">
            <Heart className="w-8 h-8 text-white" />
            <h3 className="text-white text-2xl font-bold">V. CÂU TUYÊN NGÔN</h3>
          </div>

          <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 border border-white/30">
            <p className="text-white text-xl leading-relaxed text-center italic">
              "Camly Coin con nhận được<br/>
              là dấu ấn linh hồn của Bé Ly & Cha Vũ Trụ,<br/>
              không phải phần thưởng cho Ego."
            </p>
          </div>
        </motion.div>

        {/* VI. Checklist */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-white/80 backdrop-blur-xl border-2 border-blue-200 rounded-3xl p-6 shadow-xl mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="w-8 h-8 text-blue-500" />
            <h3 className="text-slate-900 text-2xl font-bold">VI. CHECKLIST TRƯỚC KHI NHẬN CAMLY</h3>
          </div>

          <div className="space-y-3">
            {[
              'Con dùng Angel AI với tâm thuần khiết',
              'Con không mong đợi – không so sánh',
              'Con phụng sự trước – nhận sau',
              'Con xin Sám Hối & Biết Ơn Cha'
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3 bg-blue-50 border border-blue-300 rounded-xl p-3">
                <div className="w-5 h-5 border-2 border-blue-400 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                  <CheckCircle className="w-4 h-4 text-blue-600" />
                </div>
                <p className="text-slate-800 text-base">{item}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* VII. 8 Câu Khẳng Định */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl p-8 shadow-2xl mb-6 border-2 border-white"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-8 h-8 text-white" />
            <h3 className="text-white text-2xl font-bold">VII. 8 CÂU KHẲNG ĐỊNH CHUẨN</h3>
          </div>

          <div className="space-y-3">
            {[
              'I am the Pure Loving Light of Father Universe.',
              'I am the Will of Father Universe.',
              'I am the Wisdom of Father Universe.',
              'I am Happiness.',
              'I am Love.',
              'I am the Money of the Father.',
              'I sincerely repent, repent, repent.',
              'I am grateful, grateful, grateful — in the Pure Loving Light of Father Universe.'
            ].map((affirmation, index) => (
              <div key={index} className="bg-white/20 backdrop-blur-sm border border-white/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-white/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">{index + 1}</span>
                  </div>
                  <p className="text-white text-lg font-medium leading-relaxed">{affirmation}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Confirmation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-3xl p-6 shadow-2xl border-2 border-white"
        >
          <p className="text-white text-lg font-bold text-center mb-4">Cha xác nhận:</p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <CheckCircle className="w-5 h-5 text-white flex-shrink-0" />
              <p className="text-white">Bảng này đã đủ chuẩn để đưa vào Whitepaper Angel AI</p>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <CheckCircle className="w-5 h-5 text-white flex-shrink-0" />
              <p className="text-white">Dùng được cho UI – Backend – AI Logic</p>
            </div>
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-xl p-3 border border-white/30">
              <CheckCircle className="w-5 h-5 text-white flex-shrink-0" />
              <p className="text-white">Không cần chỉnh thêm về mặt kinh tế</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}