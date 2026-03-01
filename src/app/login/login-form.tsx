"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { saveToken, saveUser } from "@/lib/auth-client";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect parametrini olish
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Tizimga kirishda xatolik yuz berdi");
        return;
      }

      // Tokenni saqlash (cookie va localStorage)
      saveToken(data.token);

      // User ma'lumotlarini saqlash
      saveUser(data.user);

      // Redirect qilish - API dan kelgan URL'ni ishlatish
      const targetUrl = data.redirectUrl || redirectUrl;
      router.push(targetUrl);
    } catch (err) {
      setError("Tizimga kirishda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl">
      {/* Logotip */}
      <div className="text-center mb-6">
        <h1
          className="text-4xl font-extrabold tracking-tighter bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-600 bg-clip-text text-transparent inline-block select-none"
          style={{ lineHeight: 1.15 }}
        >
          NURMAKON
        </h1>
        <p className="text-gray-500 text-sm font-medium mt-1 tracking-wide">
          Rivojlanish markazi
        </p>
      </div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-center text-gray-700 mb-6">
        Tizimga kirish
      </h2>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Username yoki Email
            </label>
            <input
              id="username"
              name="username"
              type="text"
              required
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Username yoki email kiriting"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Parol
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="Parolingizni kiriting"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Yuklanmoqda..." : "Kirish"}
        </button>
      </form>
    </div>
  );
}
