# 🏛️ SOKRATES — Mind · Body · Wisdom

> *"Friction is not always the enemy — sometimes it is precisely what gives life its deepest flavor."*
> 





SOKRATES is an interactive learning platform that combines **physical yoga pose detection** with a **Socratic AI philosophy chatbot**. Before unlocking the dialogue, users must ground themselves in the present moment by holding a yoga pose — bridging physical awareness with intellectual exploration.

---

## ✨ Features

- 🧘 **Yoga Pose Challenge** — Real-time pose detection via webcam using MediaPipe. Hold the target pose at ≥80% accuracy for 10 seconds to unlock the AI dialogue.
- 🤖 **Sokrates AI Chatbot** — A philosophy-driven AI that engages users in Socratic dialogue, embedded from Hugging Face Spaces.
- 🌀 **Cognitive Friction Layer** — Scroll velocity detection that gently reminds users to slow down and read with intention.
- 🎯 **6 Yoga Poses** — `warrior2`, `tree`, `plank`, `downdog`, `goddess`, `namaskar`
- 📊 **91.5% Model Accuracy** — Random Forest classifier trained on 1,041 landmark samples.

---

## 🗂️ Project Structure

```
Sokrates/
├── frontend/                  # React app
│  
│
├── yoga_model/                # ML pipeline (Google Colab)
│  
│
├── huggingface_space/         # Gradio app deployed on HF Spaces for chatbot

```

---

## 🚀 Getting Started

(https://sokrates-ai-two.vercel.app/)

---

## 🧠 ML Model

The pose classifier was built entirely in Google Colab:

| Step | Tool | Detail |
|------|------|--------|
| Dataset | Kaggle Yoga Poses | 1,080 images across 5 classes |
| Custom class | Manual photos | 30 Namaskar images (self-captured) |
| Landmark extraction | MediaPipe 0.10.13 | 33 landmarks × 4 values = 132 features |
| Classifier | Random Forest | 100 estimators |
| Accuracy | **91.5%** | 80/20 train-test split |

### Pose Classes
| Pose | Emoji | Description |
|------|-------|-------------|
| warrior2 | 🥷 | Legs wide apart, arms stretched sideways |
| tree | 🌳 | Balance on one leg, hands together |
| plank | 💪 | Straight push-up hold |
| downdog | 🐕 | Inverted V shape |
| goddess | 🧘 | Wide squat, arms bent upward |
| namaskar | 🙏 | Standing, palms together at chest |

---

## 🌐 Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Chatbot backend | Hugging Face Spaces | [niloy64-sokrates.hf.space](https://niloy64-sokrates.hf.space) |
| Pose detector | Hugging Face Spaces | Gradio app |
| Frontend | Vercel | — |

---

## 🧩 Tech Stack

**Frontend**
- React 18
- CSS3 (custom animations, scroll detection)

**ML Pipeline**
- Python 3.12
- MediaPipe 0.10.13
- scikit-learn (Random Forest)
- OpenCV
- NumPy

**Deployment**
- Hugging Face Spaces (Gradio)
---

## 💡 Design Philosophy

SOKRATES is built around two types of **intentional friction**:

- **Physical friction** — You must hold a yoga pose to access the chatbot. This anchors you in your body before engaging your mind.
- **Cognitive friction** — You never get the full answer from our bot.It will train you in socratic method.i.e.It will make you search requestion and go through
-  the process and while u are studying for a quite it will bring the yoga to make you physical heath good .
-
-  and also Scroll too fast and the interface gently pushes back, reminding you to read with presence and intention.

This is not a bug. It is the feature.

---

## 📸 Screenshots


Front View::
<img width="1907" height="918" alt="image" src="https://github.com/user-attachments/assets/58308d27-a339-4ca9-9cbe-b620380c6cb5" />


The Bot::
<img width="1282" height="881" alt="image" src="https://github.com/user-attachments/assets/b3f8432d-b625-4910-b079-839abdabfaa9" />

The Yoga detector (Ml Based):
<img width="1852" height="892" alt="image" src="https://github.com/user-attachments/assets/0281f44c-bcfc-4ab0-b2a9-d9f6803fa7b5" />

---

## 🤝 Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

---

## 📄 License

MIT License — feel free to use, modify, and distribute.

---

<p align="center">Built with 🏛️ by the Nightwatch Team</p>
