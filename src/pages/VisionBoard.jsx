import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Sparkles, Target, Heart, TrendingUp, Calendar, Image as ImageIcon, Download, Loader2, Wand2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import html2canvas from 'html2canvas';
import { toast } from 'sonner';

export default function VisionBoard() {
  const [currentUser, setCurrentUser] = useState(null);
  const [step, setStep] = useState(1);
  const [inputs, setInputs] = useState({
    life_goals: '',
    career_goals: '',
    health_goals: '',
    relationship_goals: '',
    spiritual_goals: '',
    timeline: '1year',
    values: '',
    inspiration: ''
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVision, setGeneratedVision] = useState(null);
  const [visionImages, setVisionImages] = useState([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => setCurrentUser(null));
  }, []);

  const { data: myVisions = [] } = useQuery({
    queryKey: ['my-visions', currentUser?.email],
    queryFn: () => base44.entities.PersonalVision.filter({ created_by: currentUser.email }, '-created_date'),
    enabled: !!currentUser,
  });

  const generateVision = async () => {
    setIsGenerating(true);

    const vision = await base44.integrations.Core.InvokeLLM({
      prompt: `Tạo Vision Board cá nhân cho người dùng dựa trên input sau:

🎯 Mục tiêu cuộc sống: ${inputs.life_goals}
💼 Mục tiêu sự nghiệp: ${inputs.career_goals}
💪 Mục tiêu sức khỏe: ${inputs.health_goals}
❤️ Mục tiêu mối quan hệ: ${inputs.relationship_goals}
✨ Mục tiêu tâm linh: ${inputs.spiritual_goals}
📅 Khung thời gian: ${inputs.timeline === '1year' ? '1 năm' : inputs.timeline === '3years' ? '3 năm' : '5 năm'}
🌟 Giá trị cốt lõi: ${inputs.values}
💡 Nguồn cảm hứng: ${inputs.inspiration}

Hãy tạo một Vision Board đầy đủ và truyền cảm hứng với:
1. Tuyên Ngôn Tầm Nhìn (Vision Statement) - Một đoạn văn mạnh mẽ, cảm xúc
2. 5 Giá Trị Cốt Lõi - Những nguyên tắc quan trọng nhất
3. Mục Tiêu Cụ Thể theo từng lĩnh vực - SMART goals
4. Các Bước Hành Động - 10 bước cụ thể để bắt đầu
5. Câu Khẳng Định (Affirmations) - 5 câu khẳng định mạnh mẽ
6. Gợi ý 4 hình ảnh biểu tượng để minh họa vision

Format: Markdown, đầy cảm hứng, bằng tiếng Việt.`,
      response_json_schema: {
        type: "object",
        properties: {
          vision_statement: { type: "string" },
          core_values: { type: "array", items: { type: "string" } },
          goals: {
            type: "object",
            properties: {
              life: { type: "array", items: { type: "string" } },
              career: { type: "array", items: { type: "string" } },
              health: { type: "array", items: { type: "string" } },
              relationships: { type: "array", items: { type: "string" } },
              spiritual: { type: "array", items: { type: "string" } }
            }
          },
          action_steps: { type: "array", items: { type: "string" } },
          affirmations: { type: "array", items: { type: "string" } },
          image_prompts: { type: "array", items: { type: "string" } }
        }
      }
    });

    setGeneratedVision(vision);
    setIsGenerating(false);
    setStep(3);
  };

  const generateVisionImages = async () => {
    if (!generatedVision?.image_prompts) return;

    setIsGeneratingImages(true);
    const images = [];

    for (const prompt of generatedVision.image_prompts.slice(0, 4)) {
      try {
        const result = await base44.integrations.Core.GenerateImage({ prompt });
        images.push(result.url);
      } catch (error) {
        console.error('Image generation failed:', error);
      }
    }

    setVisionImages(images);
    setIsGeneratingImages(false);
  };

  const saveVision = async () => {
    await base44.entities.PersonalVision.create({
      input_thoughts: JSON.stringify(inputs),
      vision_statement: generatedVision.vision_statement,
      core_values: generatedVision.core_values,
      action_steps: generatedVision.action_steps,
      is_active: true
    });

    queryClient.invalidateQueries({ queryKey: ['my-visions'] });
    alert('✨ Vision Board đã được lưu!');
  };

  const downloadVisionBoard = async () => {
    const element = document.getElementById('vision-board-content');
    const canvas = await html2canvas(element);
    const link = document.createElement('a');
    link.download = 'my-vision-board.png';
    link.href = canvas.toDataURL();
    link.click();
  };

  const copyVisionBoard = () => {
    const timelineText = inputs.timeline === '1year' ? '1 Năm' : inputs.timeline === '3years' ? '3 Năm' : '5 Năm';
    
    let text = `🌟 VISION BOARD CỦA TÔI 🌟\n`;
    text += `Khung thời gian: ${timelineText}\n\n`;
    
    text += `📌 TẦM NHÌN:\n${generatedVision.vision_statement}\n\n`;
    
    text += `💎 GIÁ TRỊ CỐT LÕI:\n`;
    generatedVision.core_values?.forEach((value, idx) => {
      text += `${idx + 1}. ${value}\n`;
    });
    text += '\n';
    
    text += `🎯 MỤC TIÊU CỤ THỂ:\n`;
    Object.entries(generatedVision.goals || {}).forEach(([category, goals]) => {
      text += `\n${category.toUpperCase()}:\n`;
      goals?.forEach((goal, idx) => {
        text += `  ✓ ${goal}\n`;
      });
    });
    text += '\n';
    
    text += `🚀 CÁC BƯỚC HÀNH ĐỘNG:\n`;
    generatedVision.action_steps?.forEach((step, idx) => {
      text += `${idx + 1}. ${step}\n`;
    });
    text += '\n';
    
    text += `💫 KHẲNG ĐỊNH TÍCH CỰC:\n`;
    generatedVision.affirmations?.forEach((affirmation, idx) => {
      text += `${idx + 1}. "${affirmation}"\n`;
    });
    
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-purple-50 to-pink-50 relative">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-xl border-b border-purple-200 shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <Link to={createPageUrl('PersonalVision')}>
              <Button variant="ghost" size="icon">
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
                <Target className="w-5 h-5 text-white" />
              </motion.div>
              <div>
                <h1 className="text-slate-900 font-semibold text-lg">Vision Board Creator</h1>
                <p className="text-purple-600 text-xs">Powered by AI</p>
              </div>
            </div>

            <div className="w-10" />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-20 pb-32 px-4 max-w-4xl mx-auto">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`w-16 h-1 ${step > s ? 'bg-gradient-to-r from-purple-500 to-pink-500' : 'bg-slate-200'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Input Goals */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl p-6 shadow-2xl text-white text-center">
              <Target className="w-12 h-12 mx-auto mb-3" />
              <h2 className="text-2xl font-bold mb-2">Bước 1: Chia Sẻ Ước Mơ</h2>
              <p>Hãy chia sẻ mục tiêu và khát vọng của bạn. AI sẽ tạo Vision Board cá nhân hóa.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
                <label className="text-slate-900 font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-purple-500" />
                  Mục tiêu cuộc sống
                </label>
                <Textarea
                  value={inputs.life_goals}
                  onChange={(e) => setInputs({...inputs, life_goals: e.target.value})}
                  placeholder="VD: Sống ý nghĩa, giúp đỡ người khác, tự do tài chính..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
                <label className="text-slate-900 font-semibold mb-2 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  Mục tiêu sự nghiệp
                </label>
                <Textarea
                  value={inputs.career_goals}
                  onChange={(e) => setInputs({...inputs, career_goals: e.target.value})}
                  placeholder="VD: Trở thành chuyên gia, khởi nghiệp thành công..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
                <label className="text-slate-900 font-semibold mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-purple-500" />
                  Mục tiêu sức khỏe
                </label>
                <Textarea
                  value={inputs.health_goals}
                  onChange={(e) => setInputs({...inputs, health_goals: e.target.value})}
                  placeholder="VD: Tập thể dục đều đặn, ăn uống lành mạnh..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
                <label className="text-slate-900 font-semibold mb-2 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-purple-500" />
                  Mục tiêu mối quan hệ
                </label>
                <Textarea
                  value={inputs.relationship_goals}
                  onChange={(e) => setInputs({...inputs, relationship_goals: e.target.value})}
                  placeholder="VD: Cải thiện quan hệ gia đình, mở rộng mạng lưới..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
                <label className="text-slate-900 font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  Mục tiêu tâm linh
                </label>
                <Textarea
                  value={inputs.spiritual_goals}
                  onChange={(e) => setInputs({...inputs, spiritual_goals: e.target.value})}
                  placeholder="VD: Thiền định mỗi ngày, kết nối với năng lượng vũ trụ..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
                <label className="text-slate-900 font-semibold mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-purple-500" />
                  Khung thời gian
                </label>
                <select
                  value={inputs.timeline}
                  onChange={(e) => setInputs({...inputs, timeline: e.target.value})}
                  className="w-full bg-white border-2 border-purple-300 rounded-xl px-4 py-2"
                >
                  <option value="1year">1 Năm</option>
                  <option value="3years">3 Năm</option>
                  <option value="5years">5 Năm</option>
                </select>
              </div>
            </div>

            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
              <label className="text-slate-900 font-semibold mb-2 block">Giá trị cốt lõi của bạn</label>
              <Input
                value={inputs.values}
                onChange={(e) => setInputs({...inputs, values: e.target.value})}
                placeholder="VD: Trung thực, Lòng biết ơn, Sáng tạo, Yêu thương..."
              />
            </div>

            <div className="bg-white/80 backdrop-blur-xl border-2 border-purple-200 rounded-2xl p-4">
              <label className="text-slate-900 font-semibold mb-2 block">Nguồn cảm hứng</label>
              <Textarea
                value={inputs.inspiration}
                onChange={(e) => setInputs({...inputs, inspiration: e.target.value})}
                placeholder="Người bạn ngưỡng mộ, quotes yêu thích, những gì động viên bạn..."
                className="min-h-[80px]"
              />
            </div>

            <Button
              onClick={generateVision}
              disabled={!inputs.life_goals && !inputs.career_goals}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl py-6 text-lg font-bold shadow-xl"
            >
              <Wand2 className="w-5 h-5 mr-2" />
              Tạo Vision Board Với AI
            </Button>
          </motion.div>
        )}

        {/* Step 2: Generating */}
        {step === 2 && isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-20"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center mx-auto mb-6"
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>
            <h3 className="text-slate-900 font-bold text-2xl mb-2">AI Đang Tạo Vision Board...</h3>
            <p className="text-purple-600">Đang phân tích mục tiêu và tạo kế hoạch cá nhân hóa cho bạn</p>
          </motion.div>
        )}

        {/* Step 3: Result */}
        {step === 3 && generatedVision && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex justify-end gap-3 mb-6">
              <Button
                onClick={generateVisionImages}
                disabled={isGeneratingImages}
                variant="outline"
                className="border-purple-300"
              >
                {isGeneratingImages ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 mr-2" />
                )}
                Tạo Hình Ảnh
              </Button>
              <Button onClick={copyVisionBoard} variant="outline" className="border-purple-300">
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Đã Copy!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Text
                  </>
                )}
              </Button>
              <Button onClick={saveVision} variant="outline" className="border-purple-300">
                💾 Lưu Vision
              </Button>
              <Button onClick={downloadVisionBoard} variant="outline" className="border-purple-300">
                <Download className="w-4 h-4 mr-2" />
                Tải Xuống
              </Button>
            </div>

            <div id="vision-board-content" className="bg-white rounded-3xl p-8 shadow-2xl border-2 border-purple-200">
              {/* Vision Statement */}
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white text-center mb-6">
                <h2 className="text-3xl font-bold mb-4">🌟 Tầm Nhìn Của Tôi 🌟</h2>
                <p className="text-lg leading-relaxed">{generatedVision.vision_statement}</p>
              </div>

              {/* Images */}
              {visionImages.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mb-6">
                  {visionImages.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Vision ${idx + 1}`}
                      className="rounded-2xl w-full h-48 object-cover border-2 border-purple-200"
                    />
                  ))}
                </div>
              )}

              {/* Core Values */}
              <div className="mb-6">
                <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
                  <Heart className="w-6 h-6 text-purple-500" />
                  Giá Trị Cốt Lõi
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {generatedVision.core_values?.map((value, idx) => (
                    <div key={idx} className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-3 text-center">
                      <p className="text-slate-900 font-bold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Goals by Category */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {Object.entries(generatedVision.goals || {}).map(([category, goals]) => (
                  <div key={category} className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-4">
                    <h4 className="text-purple-900 font-bold mb-3 capitalize">{category}</h4>
                    <ul className="space-y-2">
                      {goals?.map((goal, idx) => (
                        <li key={idx} className="text-slate-700 text-sm flex items-start gap-2">
                          <span className="text-purple-500">✓</span>
                          <span>{goal}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Action Steps */}
              <div className="mb-6">
                <h3 className="text-slate-900 font-bold text-xl mb-4 flex items-center gap-2">
                  <Target className="w-6 h-6 text-purple-500" />
                  Các Bước Hành Động
                </h3>
                <div className="space-y-2">
                  {generatedVision.action_steps?.map((step, idx) => (
                    <div key={idx} className="flex items-start gap-3 bg-white border border-purple-200 rounded-xl p-3">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {idx + 1}
                      </div>
                      <p className="text-slate-700">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Affirmations */}
              <div className="bg-gradient-to-r from-amber-50 to-rose-50 border-2 border-amber-200 rounded-2xl p-6">
                <h3 className="text-slate-900 font-bold text-xl mb-4 text-center">💫 Khẳng Định Tích Cực</h3>
                <div className="space-y-3">
                  {generatedVision.affirmations?.map((affirmation, idx) => (
                    <p key={idx} className="text-slate-900 font-medium text-center italic">
                      "{affirmation}"
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setStep(1)}
                variant="outline"
                className="flex-1"
              >
                ← Tạo Lại
              </Button>
              <Button
                onClick={saveVision}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white"
              >
                💾 Lưu Vision Board
              </Button>
            </div>
          </motion.div>
        )}

        {/* My Visions History */}
        {step === 1 && myVisions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8"
          >
            <h3 className="text-slate-900 font-bold text-xl mb-4">Vision Boards Đã Lưu</h3>
            <div className="space-y-3">
              {myVisions.map((vision) => (
                <div key={vision.id} className="bg-white/80 border-2 border-purple-200 rounded-2xl p-4">
                  <p className="text-slate-900 font-semibold mb-2 line-clamp-2">{vision.vision_statement}</p>
                  <p className="text-xs text-slate-600">
                    {new Date(vision.created_date).toLocaleDateString('vi-VN')}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}