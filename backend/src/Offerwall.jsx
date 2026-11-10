
import React, { useEffect, useState } from "react";

const API = (
  import.meta.env.VITE_API_URL || "http://localhost:5000/api"
).replace(/\/+$/, "");

const tabs = [
  { id: "tasks", label: "Nhiệm vụ" },
  { id: "offers", label: "Offers" },
  { id: "surveys", label: "Khảo sát" }
];

export default function Offerwall({ token }) {
  const [activeTab, setActiveTab] = useState("tasks");
  const [data, setData] = useState({
    tasks: [],
    offers: [],
    surveys: []
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  async function loadTab(type) {
    setLoading(true);
    setErrors(prev => ({ ...prev, [type]: "" }));

    try {
      const response = await fetch(`${API}/offerwall/${type}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }

      setData(prev => ({
        ...prev,
        [type]: Array.isArray(result.data) ? result.data : []
      }));
    } catch (error) {
      setErrors(prev => ({
        ...prev,
        [type]: error.message
      }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab]);

  function getTitle(item) {
    return item.title || item.name || "Nhiệm vụ mới";
  }

  function getDescription(item) {
    return item.description || item.instructions || "Hoàn thành yêu cầu của đối tác để nhận thưởng.";
  }

  function getReward(item) {
    const value = Number(item.reward ?? item.payout ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  function openTask(item) {
    const url = item.url;

    if (!url || !/^https?:\/\//i.test(url)) {
      alert("Nhiệm vụ này chưa có đường dẫn hợp lệ.");
      return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
  }

  const rows = data[activeTab] || [];

  return (
    <section className="offerwall-section">
      <div className="page-intro">
        <div>
          <h2>Nhiệm vụ kiếm thưởng</h2>
          <p className="muted">
            Nhiệm vụ được tải trực tiếp từ Offerwall.me.
          </p>
        </div>

        <button
          className="btn subtle"
          onClick={() => loadTab(activeTab)}
          disabled={loading}
        >
          {loading ? "Đang tải..." : "Làm mới"}
        </button>
      </div>

      <div className="offerwall-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`btn ${activeTab === tab.id ? "primary" : "subtle"}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {errors[activeTab] && (
        <div className="alert error">
          {errors[activeTab]}
        </div>
      )}

      {loading && (
        <div className="empty">Đang tải dữ liệu từ Offerwall.me...</div>
      )}

      {!loading && !errors[activeTab] && rows.length === 0 && (
        <div className="empty">
          Hiện chưa có nhiệm vụ khả dụng. Hãy thử làm mới sau.
        </div>
      )}

      <div className="task-grid">
        {rows.map((item, index) => (
          <article
            className="task-card"
            key={item.id || item.offer_id || item.task_id || index}
          >
            <div className="task-icon">🎯</div>

            <span className="status-pill live">
              Offerwall.me
            </span>

            <h3>{getTitle(item)}</h3>

            <p>{getDescription(item)}</p>

            <div className="task-bottom">
              <b>
                {getReward(item).toFixed(4)} USD
              </b>

              <button
                className="btn primary"
                onClick={() => openTask(item)}
              >
                Tham gia
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
